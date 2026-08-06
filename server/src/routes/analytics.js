const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { MILEAGE_RATE, HOURLY_RATE } = require('../config/constants');

const router = express.Router();

// Commission only counts toward cost once an admin has verified the sale — mirrors
// server/src/routes/payments.js's verifiedCommission, kept separate since pulling in that
// file just for this helper would be an odd cross-route dependency.
function verifiedCommission(sales) {
  return (sales || []).filter((s) => s.verified).reduce((sum, s) => sum + s.commission, 0);
}

// GET /api/analytics/cac — customer acquisition cost, per ambassador and cumulative, for a
// date range (filtered by shift checkout time, matching the payroll period convention).
// Cost = hourly pay + mileage reimbursement + verified commission (the full amount actually
// paid out to acquire those sales) — not just base wage.
router.get('/cac', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const end = req.query.end ? new Date(req.query.end) : new Date();
    const start = req.query.start ? new Date(req.query.start) : new Date(end.getTime() - 30 * 24 * 3600000);

    const ambassadors = await prisma.user.findMany({
      where: { role: 'AMBASSADOR' },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        shifts: {
          where: { status: 'COMPLETED', checkoutTime: { gte: start, lte: end } },
          include: {
            payment: true,
            report: { include: { sales: true } },
            event: { select: { milesFromHq: true } },
          },
        },
      },
      orderBy: [{ firstName: 'asc' }],
    });

    const round2 = (n) => Math.round(n * 100) / 100;

    const perAmbassador = ambassadors.map((amb) => {
      const shifts = amb.shifts;

      const hoursWorked = shifts.reduce((s, sh) => s + (sh.payment?.hoursWorked || 0), 0);
      const hourlyPay = round2(hoursWorked * HOURLY_RATE);
      const milesDriven = shifts.reduce((s, sh) => s + (sh.event?.milesFromHq || 0), 0);
      const mileageReimbursement = round2(milesDriven * MILEAGE_RATE);
      const commissionEarned = round2(shifts.reduce((s, sh) => s + verifiedCommission(sh.report?.sales), 0));
      const totalCost = round2(hourlyPay + mileageReimbursement + commissionEarned);

      const salesCount = shifts.reduce((s, sh) => s + (sh.report?.totalSales || 0), 0);
      const cac = salesCount > 0 ? round2(totalCost / salesCount) : null;
      const avgHoursPerSale = salesCount > 0 ? round2(hoursWorked / salesCount) : null;

      return {
        ambassadorId: amb.id,
        firstName: amb.firstName,
        lastName: amb.lastName,
        email: amb.email,
        shiftCount: shifts.length,
        hoursWorked: round2(hoursWorked),
        totalCost,
        salesCount,
        cac,
        avgHoursPerSale,
      };
    });

    const cumulative = perAmbassador.reduce(
      (acc, a) => ({
        shiftCount: acc.shiftCount + a.shiftCount,
        hoursWorked: round2(acc.hoursWorked + a.hoursWorked),
        totalCost: round2(acc.totalCost + a.totalCost),
        salesCount: acc.salesCount + a.salesCount,
      }),
      { shiftCount: 0, hoursWorked: 0, totalCost: 0, salesCount: 0 }
    );
    cumulative.cac = cumulative.salesCount > 0 ? round2(cumulative.totalCost / cumulative.salesCount) : null;
    cumulative.avgHoursPerSale = cumulative.salesCount > 0 ? round2(cumulative.hoursWorked / cumulative.salesCount) : null;

    res.json({
      start: start.toISOString(),
      end: end.toISOString(),
      cumulative,
      perAmbassador: perAmbassador.sort((a, b) => (b.cac ?? -1) - (a.cac ?? -1)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
