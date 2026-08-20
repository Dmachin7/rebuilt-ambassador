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

      // On-site hours only (checkin → checkout) — excludes drive time, unlike `hoursWorked`
      // above which is the full paid amount. This is what "hours to get a sale" should reflect.
      const onSiteHours = shifts.reduce((s, sh) => {
        if (!sh.checkinTime || !sh.checkoutTime) return s;
        return s + (new Date(sh.checkoutTime) - new Date(sh.checkinTime)) / 3600000;
      }, 0);

      // Prefer the payroll-corrected sales count (Payment.salesOverride) over the raw reported
      // total, same as payments.js's withBreakdown/biweekly summary — otherwise a correction made
      // via Payroll's Edit Breakdown never shows up here since it doesn't touch Sale rows.
      const salesCount = shifts.reduce((s, sh) => s + (sh.payment?.salesOverride ?? sh.report?.totalSales ?? 0), 0);
      const cac = salesCount > 0 ? round2(totalCost / salesCount) : null;
      const avgHoursPerSale = salesCount > 0 ? round2(onSiteHours / salesCount) : null;

      return {
        ambassadorId: amb.id,
        firstName: amb.firstName,
        lastName: amb.lastName,
        email: amb.email,
        shiftCount: shifts.length,
        hoursWorked: round2(hoursWorked),
        onSiteHours: round2(onSiteHours),
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
        onSiteHours: round2(acc.onSiteHours + a.onSiteHours),
        totalCost: round2(acc.totalCost + a.totalCost),
        salesCount: acc.salesCount + a.salesCount,
      }),
      { shiftCount: 0, hoursWorked: 0, onSiteHours: 0, totalCost: 0, salesCount: 0 }
    );
    cumulative.cac = cumulative.salesCount > 0 ? round2(cumulative.totalCost / cumulative.salesCount) : null;
    cumulative.avgHoursPerSale = cumulative.salesCount > 0 ? round2(cumulative.onSiteHours / cumulative.salesCount) : null;

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

// GET /api/analytics/ambassador-stats — all-time (no date range) avg on-site hours per sale,
// conversion % (shifts with at least one sale ÷ shifts worked), and lifetime sales total per
// ambassador, keyed by ambassadorId — for the roster cards on the Ambassadors page. Folds in
// imported HistoricalPromo rows (pre-app promo history) matched to this ambassador, so lifetime
// figures reflect the full history, not just what's been worked since the app launched.
router.get('/ambassador-stats', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const ambassadors = await prisma.user.findMany({
      where: { role: 'AMBASSADOR' },
      select: {
        id: true,
        shifts: {
          where: { status: 'COMPLETED' },
          select: {
            checkinTime: true,
            checkoutTime: true,
            report: { select: { totalSales: true } },
            payment: { select: { salesOverride: true } },
          },
        },
        historicalPromos: {
          select: { hoursWorked: true, salesCount: true },
        },
      },
    });

    const round2 = (n) => Math.round(n * 100) / 100;
    // Prefer the payroll-corrected sales count (Payment.salesOverride) over the raw reported
    // total — same convention as payments.js, so a correction made via Payroll's Edit Breakdown
    // shows up here too instead of only in Payroll.
    const shiftSales = (sh) => sh.payment?.salesOverride ?? sh.report?.totalSales ?? 0;
    const stats = {};
    ambassadors.forEach((amb) => {
      const shifts = amb.shifts;
      const liveOnSiteHours = shifts.reduce((s, sh) => {
        if (!sh.checkinTime || !sh.checkoutTime) return s;
        return s + (new Date(sh.checkoutTime) - new Date(sh.checkinTime)) / 3600000;
      }, 0);
      const liveSales = shifts.reduce((s, sh) => s + shiftSales(sh), 0);
      const liveShiftsWithSale = shifts.filter((sh) => shiftSales(sh) > 0).length;

      const historical = amb.historicalPromos;
      const historicalHours = historical.reduce((s, h) => s + h.hoursWorked, 0);
      const historicalSales = historical.reduce((s, h) => s + h.salesCount, 0);
      const historicalWithSale = historical.filter((h) => h.salesCount > 0).length;

      const onSiteHours = liveOnSiteHours + historicalHours;
      const salesTotal = liveSales + historicalSales;
      const workedCount = shifts.length + historical.length;
      const withSaleCount = liveShiftsWithSale + historicalWithSale;

      stats[amb.id] = {
        shiftCount: shifts.length,
        salesTotal,
        avgHoursPerSale: salesTotal > 0 ? round2(onSiteHours / salesTotal) : null,
        conversionPct: workedCount > 0 ? round2((withSaleCount / workedCount) * 100) : null,
      };
    });

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/promo-log — flat per-promo log for a date range: one row per shift
// worked (live app data) plus imported HistoricalPromo rows, merged and sorted by date. This
// mirrors the manual spreadsheet the team tracked this in before the app existed — see
// HistoricalPromo in schema.prisma for why history is a separate table rather than fake
// Event/Shift rows. Deliberately excludes cost/mileage — this is a work log, not the CAC report.
router.get('/promo-log', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const end = req.query.end ? new Date(req.query.end) : new Date();
    const start = req.query.start ? new Date(req.query.start) : new Date(end.getTime() - 30 * 24 * 3600000);
    const endInclusive = new Date(end.getTime() + 24 * 3600000);

    const round2 = (n) => Math.round(n * 100) / 100;

    const shifts = await prisma.shift.findMany({
      where: {
        status: 'COMPLETED',
        ambassadorId: { not: null },
        event: { date: { gte: start, lt: endInclusive } },
      },
      include: {
        event: { select: { title: true, location: true, date: true } },
        ambassador: { select: { id: true, firstName: true, lastName: true } },
        report: { select: { totalSales: true, mealsSold: true } },
        payment: { select: { salesOverride: true } },
      },
    });

    const liveRows = shifts.map((s) => {
      const onSiteHours = s.checkinTime && s.checkoutTime
        ? round2((new Date(s.checkoutTime) - new Date(s.checkinTime)) / 3600000)
        : null;
      const salesCount = s.payment?.salesOverride ?? s.report?.totalSales ?? 0;
      const mealsSold = s.report?.mealsSold ?? 0;
      return {
        source: 'live',
        shiftId: s.id,
        promoName: s.event.location || s.event.title,
        date: s.event.date,
        ambassadorId: s.ambassador.id,
        ambassadorName: `${s.ambassador.firstName} ${s.ambassador.lastName}`,
        hoursWorked: onSiteHours,
        salesCount,
        mealsSold,
        avgMealsPerSale: salesCount > 0 ? round2(mealsSold / salesCount) : null,
      };
    });

    const historical = await prisma.historicalPromo.findMany({
      where: { date: { gte: start, lt: endInclusive } },
      include: { ambassador: { select: { id: true, firstName: true, lastName: true } } },
    });

    const historicalRows = historical.map((h) => ({
      source: 'imported',
      shiftId: h.id,
      promoName: h.promoName,
      date: h.date,
      ambassadorId: h.ambassadorId,
      // Imported rows with no matching account are almost always people no longer on the team —
      // shown generically rather than by name (the raw CSV name is still kept in the DB for
      // audit purposes, just not surfaced here).
      ambassadorName: h.ambassador ? `${h.ambassador.firstName} ${h.ambassador.lastName}` : 'Ex-Employee',
      hoursWorked: h.hoursWorked,
      salesCount: h.salesCount,
      mealsSold: h.mealsSold,
      avgMealsPerSale: h.salesCount > 0 ? round2(h.mealsSold / h.salesCount) : null,
    }));

    const rows = [...liveRows, ...historicalRows].sort((a, b) => new Date(b.date) - new Date(a.date));

    const totals = rows.reduce(
      (acc, r) => ({
        hoursWorked: round2(acc.hoursWorked + (r.hoursWorked || 0)),
        salesCount: acc.salesCount + r.salesCount,
        mealsSold: acc.mealsSold + r.mealsSold,
      }),
      { hoursWorked: 0, salesCount: 0, mealsSold: 0 }
    );

    res.json({ start: start.toISOString(), end: end.toISOString(), rows, totals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
