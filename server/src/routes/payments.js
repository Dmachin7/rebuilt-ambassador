const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { MILEAGE_RATE, HOURLY_RATE, MIN_PAID_HOURS } = require('../config/constants');

const router = express.Router();

// Commission only counts toward payroll once an admin has verified the sale against Shopify
function verifiedCommission(sales) {
  return (sales || []).filter((s) => s.verified).reduce((sum, s) => sum + s.commission, 0);
}

function pendingSaleCount(sales) {
  return (sales || []).filter((s) => !s.verified).length;
}

// Adds a pay/reimbursement breakdown to a Payment (with shift.event and shift.report.sales
// included), mirroring the on-the-fly mileage/commission math used elsewhere in this file.
// Any *Override column set on the Payment (via PUT /:id/breakdown) wins over the live
// Event/Shift/Report-computed value, so an admin correction only affects this one payment.
//
// "onSiteHours" here means the full checked-in window (checkout - checkin), which already
// covers setup time since ambassadors check in when they arrive to set up — setup is not
// tracked or added as a separate bucket to avoid double-counting.
function withBreakdown(payment) {
  const event = payment.shift?.event;
  const computedOnSiteHours = payment.shift?.checkinTime && payment.shift?.checkoutTime
    ? (new Date(payment.shift.checkoutTime) - new Date(payment.shift.checkinTime)) / 3600000
    : null;
  const computedDriveTimeHours = ((event?.driveTimeMins || 0) * 2) / 60;
  const computedMiles = (event?.milesFromHq || 0) * 2;
  const computedSales = payment.shift?.report?.totalSales || 0;
  const computedCommission = verifiedCommission(payment.shift?.report?.sales);
  const pendingSales = pendingSaleCount(payment.shift?.report?.sales);

  const onSiteHours = payment.onSiteHoursOverride ?? computedOnSiteHours;
  const driveTimeHours = payment.driveTimeHoursOverride ?? computedDriveTimeHours;
  const miles = payment.milesOverride ?? computedMiles;
  const sales = payment.salesOverride ?? computedSales;
  const commissionEarned = payment.commissionOverride ?? computedCommission;
  const mileageReimbursement = Math.round(miles * MILEAGE_RATE * 100) / 100;

  return {
    ...payment,
    breakdown: {
      onSiteHours: onSiteHours != null ? Math.round(onSiteHours * 100) / 100 : null,
      driveTimeHours: Math.round(driveTimeHours * 100) / 100,
      miles: Math.round(miles * 10) / 10,
      mileageReimbursement,
      sales,
      commissionEarned: Math.round(commissionEarned * 100) / 100,
      pendingSales,
      isEdited: [
        payment.onSiteHoursOverride, payment.driveTimeHoursOverride,
        payment.milesOverride, payment.salesOverride, payment.commissionOverride,
      ].some((v) => v != null),
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
            event: { select: { milesFromHq: true, driveTimeMins: true } },
          },
        },
      },
    });

    const summary = ambassadors.map((amb) => {
      const completedShifts = amb.shifts;

      const hoursWorked = completedShifts.reduce((s, sh) => s + (sh.payment?.hoursWorked || 0), 0);
      const hourlyPay = Math.round(hoursWorked * HOURLY_RATE * 100) / 100;

      const driveTimeHours = completedShifts.reduce((s, sh) => s + ((sh.event?.driveTimeMins || 0) * 2) / 60, 0);

      const milesDriven = completedShifts.reduce((s, sh) => s + (sh.event?.milesFromHq || 0) * 2, 0); // round trip
      const mileageReimbursement = Math.round(milesDriven * MILEAGE_RATE * 100) / 100;

      const salesThisPeriod = completedShifts.reduce((s, sh) => s + (sh.report?.totalSales || 0), 0);
      const commissionEarned = Math.round(
        completedShifts.reduce((s, sh) => s + verifiedCommission(sh.report?.sales), 0) * 100
      ) / 100;
      const pendingSales = completedShifts.reduce((s, sh) => s + pendingSaleCount(sh.report?.sales), 0);

      const totalPayout = Math.round((hourlyPay + mileageReimbursement + commissionEarned) * 100) / 100;

      return {
        ambassadorId: amb.id,
        firstName: amb.firstName,
        lastName: amb.lastName,
        email: amb.email,
        lifetimeSalesCount: amb.lifetimeSalesCount,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        hourlyPay,
        driveTimeHours: Math.round(driveTimeHours * 100) / 100,
        milesDriven: Math.round(milesDriven * 10) / 10,
        mileageReimbursement,
        salesThisPeriod,
        commissionEarned,
        pendingSales,
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
          shift: { include: { event: true, report: { include: { sales: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(payments.map(withBreakdown));
    }

    const where = { ambassadorId: req.user.id };
    if (status) where.status = status;
    const payments = await prisma.payment.findMany({
      where,
      include: { shift: { include: { event: true, report: { include: { sales: true } } } } },
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

// PUT /api/payments/:id/breakdown — admin only, correct one payment's line items
// (on-site hours, drive hours, miles, sales, commission) without touching the shared
// Event/Shift/Report data used by other ambassadors on the same event.
router.put('/:id/breakdown', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { onSiteHours, driveTimeHours, miles, sales, commissionEarned } = req.body;
    const numericFields = { onSiteHours, driveTimeHours, miles, sales, commissionEarned };
    for (const [key, value] of Object.entries(numericFields)) {
      if (value === undefined || value === null) continue;
      if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
        return res.status(400).json({ error: `${key} must be a non-negative number` });
      }
    }

    const hoursWorked = Math.round(
      Math.max(MIN_PAID_HOURS, (onSiteHours || 0) + (driveTimeHours || 0)) * 100
    ) / 100;
    const amount = Math.round(hoursWorked * HOURLY_RATE * 100) / 100;

    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: {
        hoursWorked,
        amount,
        onSiteHoursOverride: onSiteHours,
        driveTimeHoursOverride: driveTimeHours,
        milesOverride: miles,
        salesOverride: sales,
        commissionOverride: commissionEarned,
      },
      include: {
        ambassador: {
          select: { id: true, firstName: true, lastName: true, email: true, legalName: true, address: true },
        },
        shift: { include: { event: true, report: { include: { sales: true } } } },
      },
    });
    res.json(withBreakdown(payment));
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
