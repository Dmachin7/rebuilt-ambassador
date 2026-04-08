const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendDailySummary, sendWeeklyNotification } = require('../stubs/email');

const router = express.Router();

// POST /api/notifications/daily — trigger end-of-day summary (admin only)
router.post('/daily', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 3600000);

    const [completedShifts, mealsSoldSum, admins] = await Promise.all([
      prisma.shift.findMany({
        where: { status: 'COMPLETED', checkoutTime: { gte: startOfDay, lte: endOfDay } },
        include: { payment: true, report: true },
      }),
      prisma.report.aggregate({
        where: { submittedAt: { gte: startOfDay, lte: endOfDay } },
        _sum: { mealsSold: true },
      }),
      prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }),
    ]);

    const totalHours = completedShifts.reduce((s, sh) => s + (sh.payment?.hoursWorked || 0), 0);
    const adminEmails = admins.map((a) => a.email);
    const summary = {
      date: today.toLocaleDateString('en-US'),
      shiftsCompleted: completedShifts.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalMealsSold: mealsSoldSum._sum.mealsSold || 0,
    };

    await sendDailySummary(adminEmails, summary);
    res.json({ success: true, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/weekly — trigger weekly notification (admin only)
router.post('/weekly', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const now = new Date();
    const weekEnd = new Date(now);
    const weekStart = new Date(now.getTime() - 7 * 24 * 3600000);

    const [completedShifts, reportAgg, admins] = await Promise.all([
      prisma.shift.findMany({
        where: { status: 'COMPLETED', checkoutTime: { gte: weekStart, lte: weekEnd } },
        include: { payment: true },
      }),
      prisma.report.aggregate({
        where: { submittedAt: { gte: weekStart, lte: weekEnd } },
        _sum: { mealsSold: true, totalSales: true },
      }),
      prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }),
    ]);

    const totalHours = completedShifts.reduce((s, sh) => s + (sh.payment?.hoursWorked || 0), 0);
    const adminEmails = admins.map((a) => a.email);
    const summary = {
      weekStart: weekStart.toLocaleDateString('en-US'),
      weekEnd: weekEnd.toLocaleDateString('en-US'),
      shiftsCompleted: completedShifts.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalMealsSold: reportAgg._sum.mealsSold || 0,
      totalSales: reportAgg._sum.totalSales || 0,
    };

    await sendWeeklyNotification(adminEmails, summary);
    res.json({ success: true, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
