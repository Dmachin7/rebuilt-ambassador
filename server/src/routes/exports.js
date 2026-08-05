const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// Monday-start week bucket for a date, matching the Monday-Sunday convention used across the
// Calendar and Availability pages.
function startOfWeekMonday(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const diffToMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  return date;
}

// start/end (YYYY-MM-DD) let admins report on any range, including past weeks — so we
// only exclude CANCELLED events rather than restricting to UPCOMING/ACTIVE.
async function weeklyProjections({ start, end } = {}) {
  const where = {
    status: { not: 'CANCELLED' },
    OR: [{ samplesNeeded: { gt: 0 } }, { breakfastsNeeded: { gt: 0 } }, { snackBitesNeeded: { gt: 0 } }],
  };
  if (start || end) {
    where.date = {};
    if (start) where.date.gte = new Date(start);
    if (end) {
      const endExclusive = new Date(end);
      endExclusive.setDate(endExclusive.getDate() + 1);
      where.date.lt = endExclusive;
    }
  }

  const events = await prisma.event.findMany({
    where,
    select: { date: true, samplesNeeded: true, breakfastsNeeded: true, snackBitesNeeded: true },
    orderBy: { date: 'asc' },
  });

  const byWeek = new Map(); // weekStart ISO -> { weekStart, weekEnd, totalMeals, totalBreakfasts, totalSnackBites, eventCount }
  events.forEach((e) => {
    const weekStart = startOfWeekMonday(e.date);
    const key = weekStart.toISOString();
    if (!byWeek.has(key)) {
      const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
      byWeek.set(key, { weekStart, weekEnd, totalMeals: 0, totalBreakfasts: 0, totalSnackBites: 0, eventCount: 0 });
    }
    const bucket = byWeek.get(key);
    bucket.totalMeals += e.samplesNeeded || 0;
    bucket.totalBreakfasts += e.breakfastsNeeded || 0;
    bucket.totalSnackBites += e.snackBitesNeeded || 0;
    bucket.eventCount += 1;
  });

  return Array.from(byWeek.values()).sort((a, b) => a.weekStart - b.weekStart);
}

// GET /api/exports/projections — weekly meals/snack-bites needed across upcoming events
router.get('/projections', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { start, end } = req.query;
    const weeks = await weeklyProjections({ start, end });
    res.json(weeks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/exports/projections/csv
router.get('/projections/csv', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { start, end } = req.query;
    const weeks = await weeklyProjections({ start, end });
    const headers = ['Week Start', 'Week End', 'Total Meals', 'Total Breakfasts', 'Total Snack Bites', 'Events'];
    const rows = weeks.map((w) => [
      w.weekStart.toISOString().split('T')[0],
      w.weekEnd.toISOString().split('T')[0],
      w.totalMeals,
      w.totalBreakfasts,
      w.totalSnackBites,
      w.eventCount,
    ]);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');

    const filename = `rebuilt-projections-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
