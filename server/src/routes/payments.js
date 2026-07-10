const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { MILEAGE_RATE, HOURLY_RATE } = require('../config/constants');

const router = express.Router();

// Commission only counts toward payroll once an admin has verified the sale against Shopify
function verifiedCommission(sales) {
  return (sales || []).filter((s) => s.verified).reduce((sum, s) => sum + s.commission, 0);
}

function pendingSaleCount(sales) {
  return (sales || []).filter((s) => !s.verified).length;
}

// Adds a read-only pay/reimbursement breakdown to a Payment (with shift.event included) without
// persisting new columns — mirrors the on-the-fly mileage math used elsewhere in this file.
function withBreakdown(payment) {
  const event = payment.shift?.event;
  const onSiteHours = payment.shift?.checkinTime && payment.shift?.checkoutTime
    ? (new Date(payment.shift.checkoutTime) - new Date(payment.shift.checkinTime)) / 3600000
    : null;
  const driveTimeHours = ((event?.driveTimeMins || 0) * 2) / 60;
  const setupTimeHours = (event?.setupTimeMins || 0) / 60;
  const miles = (event?.milesFromHq || 0) * 2;
  const mileageReimbursement = Math.round(miles * MILEAGE_RATE * 100) / 100;
  return {
    ...payment,
    breakdown: {
      onSiteHours: onSiteHours !== null ? Math.round(onSiteHours * 100) / 100 : null,
      driveTimeHours: Math.round(driveTimeHours * 100) / 100,
      setupTimeHours: Math.round(setupTimeHours * 100) / 100,
      miles: Math.round(miles * 10) / 10,
      mileageReimbursement,
    },
  };
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
            report: { include: { sales: true } },
            event: { select: { title: true, date: true, milesFromHq: true, driveTimeMins: true, setupTimeMins: true } },
          },
        },
      },
    });

    const summary = ambassadors.map((amb) => {
      const completedShifts = amb.shifts;

      const hoursWorked = completedShifts.reduce((s, sh) => s + (sh.payment?.hoursWorked || 0), 0);
      const hourlyPay = Math.round(hoursWorked * HOURLY_RATE * 100) / 100;

      const driveTimeHours = completedShifts.reduce((s, sh) => s + ((sh.event?.driveTimeMins || 0) * 2) / 60, 0);
      const setupTimeHours = completedShifts.reduce((s, sh) => s + (sh.event?.setupTimeMins || 0) / 60, 0);

      const milesDriven = completedShifts.reduce((s, sh) => s + (sh.event?.milesFromHq || 0) * 2, 0); // round trip
      const mileageReimbursement = Math.round(milesDriven * MILEAGE_RATE * 100) / 100;

      const salesThisPeriod = completedShifts.reduce((s, sh) => s + (sh.report?.totalSales || 0), 0);
      const commissionEarned = Math.round(
        completedShifts.reduce((s, sh) => s + verifiedCommission(sh.report?.sales), 0) * 100
      ) / 100;
      const pendingSales = completedShifts.reduce((s, sh) => s + pendingSaleCount(sh.report?.sales), 0);

      const totalPayout = Math.round((hourlyPay + mileageReimbursement + commissionEarned) * 100) / 100;

      // Per-shift line items so the admin can see exactly how each shift's pay was built
      const shifts = completedShifts.map((sh) => {
        const shOnSiteHours = sh.checkinTime && sh.checkoutTime
          ? (new Date(sh.checkoutTime) - new Date(sh.checkinTime)) / 3600000
          : null;
        const shDriveTimeHours = ((sh.event?.driveTimeMins || 0) * 2) / 60;
        const shSetupTimeHours = (sh.event?.setupTimeMins || 0) / 60;
        const shHoursWorked = sh.payment?.hoursWorked || 0;
        const shHourlyPay = Math.round(shHoursWorked * HOURLY_RATE * 100) / 100;
        const shMiles = (sh.event?.milesFromHq || 0) * 2;
        const shMileageReimbursement = Math.round(shMiles * MILEAGE_RATE * 100) / 100;
        const shSales = sh.report?.totalSales || 0;
        const shCommission = Math.round(verifiedCommission(sh.report?.sales) * 100) / 100;
        const shPendingSales = pendingSaleCount(sh.report?.sales);
        const shTotalPayout = Math.round((shHourlyPay + shMileageReimbursement + shCommission) * 100) / 100;

        return {
          shiftId: sh.id,
          eventTitle: sh.event?.title || 'Untitled Event',
          eventDate: sh.event?.date || null,
          onSiteHours: shOnSiteHours !== null ? Math.round(shOnSiteHours * 100) / 100 : null,
          driveTimeHours: Math.round(shDriveTimeHours * 100) / 100,
          setupTimeHours: Math.round(shSetupTimeHours * 100) / 100,
          hoursWorked: Math.round(shHoursWorked * 100) / 100,
          hourlyPay: shHourlyPay,
          miles: Math.round(shMiles * 10) / 10,
          mileageReimbursement: shMileageReimbursement,
          sales: shSales,
          commissionEarned: shCommission,
          pendingSales: shPendingSales,
          totalPayout: shTotalPayout,
        };
      });

      return {
        ambassadorId: amb.id,
        firstName: amb.firstName,
        lastName: amb.lastName,
        email: amb.email,
        lifetimeSalesCount: amb.lifetimeSalesCount,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        hourlyPay,
        driveTimeHours: Math.round(driveTimeHours * 100) / 100,
        setupTimeHours: Math.round(setupTimeHours * 100) / 100,
        milesDriven: Math.round(milesDriven * 10) / 10,
        mileageReimbursement,
        salesThisPeriod,
        commissionEarned,
        pendingSales,
        totalPayout,
        shiftCount: completedShifts.length,
        shifts,
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
            report: { include: { sales: true } },
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
      'Avg Meals/Sale', 'Commission Earned', 'Pending Sales', 'Total Payout',
    ];

    const rows = payments.map((p) => {
      const miles = (p.shift.event.milesFromHq || 0) * 2;
      const mileageReimbursement = Math.round(miles * MILEAGE_RATE * 100) / 100;
      const salesThisShift = p.shift.report?.totalSales || 0;
      const commission = verifiedCommission(p.shift.report?.sales);
      const pending = pendingSaleCount(p.shift.report?.sales);
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
        pending,
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
      return res.json(payments.map(withBreakdown));
    }

    const where = { ambassadorId: req.user.id };
    if (status) where.status = status;
    const payments = await prisma.payment.findMany({
      where,
      include: { shift: { include: { event: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments.map(withBreakdown));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/payments/bulk-status — admin only, approve/mark-paid multiple payments at once
router.put('/bulk-status', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids (non-empty array) is required' });
    }
    if (!['PENDING', 'APPROVED', 'PAID'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be PENDING, APPROVED, or PAID' });
    }
    const result = await prisma.payment.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    res.json({ updated: result.count });
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
