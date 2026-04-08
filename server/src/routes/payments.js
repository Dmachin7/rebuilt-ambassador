const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// Commission calculation: $10/sale for first 50 lifetime, $20/sale after
function calcCommission(lifetimeBefore, salesThisPeriod) {
  const THRESHOLD = 50;
  let commission = 0;
  let remaining = salesThisPeriod;
  if (lifetimeBefore < THRESHOLD) {
    const atLowRate = Math.min(remaining, THRESHOLD - lifetimeBefore);
    commission += atLowRate * 10;
    remaining -= atLowRate;
  }
  commission += remaining * 20;
  return commission;
}

// GET /api/payments/biweekly — bi-weekly payroll summary (admin only)
router.get('/biweekly', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    // Default: last 14 days; support ?start=ISO&end=ISO query params
    const end = req.query.end ? new Date(req.query.end) : new Date();
    const start = req.query.start ? new Date(req.query.start) : new Date(end.getTime() - 14 * 24 * 3600000);

    const ambassadors = await prisma.user.findMany({
      where: { role: 'AMBASSADOR' },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        lifetimeSalesCount: true,
        shifts: {
          where: {
            status: 'COMPLETED',
            checkoutTime: { gte: start, lte: end },
          },
          include: {
            payment: true,
            report: true,
            event: { select: { milesFromHq: true } },
          },
        },
      },
    });

    const summary = ambassadors.map((amb) => {
      const completedShifts = amb.shifts;

      const hoursWorked = completedShifts.reduce((s, sh) => s + (sh.payment?.hoursWorked || 0), 0);
      const hourlyPay = Math.round(hoursWorked * 20 * 100) / 100;

      const milesDriven = completedShifts.reduce((s, sh) => s + (sh.event?.milesFromHq || 0) * 2, 0); // round trip
      const mileageReimbursement = Math.round(milesDriven * 0.30 * 100) / 100;

      const salesThisPeriod = completedShifts.reduce((s, sh) => s + (sh.report?.totalSales || 0), 0);
      const lifetimeBefore = Math.max(0, (amb.lifetimeSalesCount || 0) - salesThisPeriod);
      const commissionEarned = calcCommission(lifetimeBefore, salesThisPeriod);

      const totalPayout = Math.round((hourlyPay + mileageReimbursement + commissionEarned) * 100) / 100;

      return {
        ambassadorId: amb.id,
        firstName: amb.firstName,
        lastName: amb.lastName,
        email: amb.email,
        lifetimeSalesCount: amb.lifetimeSalesCount,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        hourlyPay,
        milesDriven: Math.round(milesDriven * 10) / 10,
        mileageReimbursement,
        salesThisPeriod,
        commissionEarned,
        totalPayout,
        shiftCount: completedShifts.length,
      };
    });

    res.json({ start: start.toISOString(), end: end.toISOString(), summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/export/csv — must come before /:id routes
router.get('/export/csv', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        ambassador: true,
        shift: {
          include: {
            event: true,
            report: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Payment ID', 'Status', 'First Name', 'Last Name', 'Legal Name', 'Email',
      'Phone', 'Address', 'SSN (Placeholder)', 'Event', 'Event Date',
      'Check-In Time', 'Check-Out Time', 'Hours Worked', 'Hourly Pay',
      'Miles Driven', 'Mileage Reimbursement', 'Total Meals Sold', 'Total Sales',
      'Avg Meals/Sale', 'Commission Earned', 'Total Payout',
    ];

    const rows = payments.map((p) => {
      const miles = (p.shift.event.milesFromHq || 0) * 2;
      const mileageReimbursement = Math.round(miles * 0.30 * 100) / 100;
      const salesThisShift = p.shift.report?.totalSales || 0;
      const lifetimeBefore = Math.max(0, (p.ambassador.lifetimeSalesCount || 0) - salesThisShift);
      const commission = calcCommission(lifetimeBefore, salesThisShift);
      const totalPayout = p.amount + mileageReimbursement + commission;

      return [
        p.id,
        p.status,
        p.ambassador.firstName,
        p.ambassador.lastName,
        p.ambassador.legalName || '',
        p.ambassador.email,
        p.ambassador.phone || '',
        p.ambassador.address || '',
        p.ambassador.ssnPlaceholder || '',
        p.shift.event.title,
        new Date(p.shift.event.date).toISOString().split('T')[0],
        p.shift.checkinTime ? new Date(p.shift.checkinTime).toISOString() : '',
        p.shift.checkoutTime ? new Date(p.shift.checkoutTime).toISOString() : '',
        p.hoursWorked.toFixed(2),
        `$${p.amount.toFixed(2)}`,
        miles.toFixed(1),
        `$${mileageReimbursement.toFixed(2)}`,
        p.shift.report?.mealsSold ?? '',
        salesThisShift,
        p.shift.report?.mealsPerSale?.toFixed(1) ?? '',
        `$${commission.toFixed(2)}`,
        `$${totalPayout.toFixed(2)}`,
      ];
    });

    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');

    const filename = `rebuilt-payroll-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status } = req.query;

    if (req.user.role === 'ADMIN') {
      const where = status ? { status } : {};
      const payments = await prisma.payment.findMany({
        where,
        include: {
          ambassador: {
            select: { id: true, firstName: true, lastName: true, email: true, legalName: true, address: true },
          },
          shift: { include: { event: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(payments);
    }

    const where = { ambassadorId: req.user.id };
    if (status) where.status = status;
    const payments = await prisma.payment.findMany({
      where,
      include: { shift: { include: { event: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/payments/:id/status — admin only
router.put('/:id/status', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'APPROVED', 'PAID'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be PENDING, APPROVED, or PAID' });
    }
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
