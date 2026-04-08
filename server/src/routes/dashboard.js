const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendPushNotification } = require('../stubs/notifications');
const { sendUrgentAlert } = require('../stubs/sms');

const router = express.Router();

// Commission calculation helper
// lifetimeBefore = lifetime sales count BEFORE this period
// salesThisPeriod = sales earned in this period
function calcCommission(lifetimeBefore, salesThisPeriod) {
  const THRESHOLD = 50;
  const RATE_LOW = 10;
  const RATE_HIGH = 20;

  let commission = 0;
  let remaining = salesThisPeriod;

  if (lifetimeBefore < THRESHOLD) {
    const atLowRate = Math.min(remaining, THRESHOLD - lifetimeBefore);
    commission += atLowRate * RATE_LOW;
    remaining -= atLowRate;
  }
  commission += remaining * RATE_HIGH;
  return commission;
}

// GET /api/dashboard/admin
router.get('/admin', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 3600000);

    const [eventCounts, upcomingEvents, openShifts, pendingPayments, ambassadors] = await Promise.all([
      prisma.event.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.event.findMany({
        where: { date: { gte: now, lte: next7Days } },
        include: {
          shifts: {
            include: {
              ambassador: { select: { id: true, firstName: true, lastName: true, isAvailable: true } },
            },
          },
          _count: { select: { shifts: true } },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.shift.findMany({
        where: { status: 'OPEN' },
        include: { event: true },
        orderBy: { event: { date: 'asc' } },
      }),
      prisma.payment.findMany({
        where: { status: 'PENDING' },
        include: {
          ambassador: { select: { id: true, firstName: true, lastName: true } },
          shift: { include: { event: { select: { title: true, date: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.findMany({
        where: { role: 'AMBASSADOR' },
        select: { id: true, firstName: true, lastName: true, email: true, isAvailable: true, lifetimeSalesCount: true },
        orderBy: { firstName: 'asc' },
      }),
    ]);

    const ambassadorStats = await Promise.all(
      ambassadors.map(async (amb) => {
        const [shiftCount, paySum, mealsSoldSum] = await Promise.all([
          prisma.shift.count({ where: { ambassadorId: amb.id, status: 'COMPLETED' } }),
          prisma.payment.aggregate({
            where: { ambassadorId: amb.id },
            _sum: { hoursWorked: true, amount: true },
          }),
          prisma.report.aggregate({
            where: { shift: { ambassadorId: amb.id } },
            _sum: { mealsSold: true },
          }),
        ]);
        return {
          ...amb,
          shiftsWorked: shiftCount,
          totalHours: paySum._sum.hoursWorked || 0,
          totalEarnings: paySum._sum.amount || 0,
          totalMealsSold: mealsSoldSum._sum.mealsSold || 0,
        };
      })
    );

    const eventCountMap = {};
    eventCounts.forEach((e) => { eventCountMap[e.status] = e._count.id; });

    res.json({
      eventCounts: eventCountMap,
      upcomingEvents,
      openShifts,
      pendingPayments,
      ambassadorStats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dashboard/ambassador
router.get('/ambassador', verifyToken, requireRole('AMBASSADOR'), async (req, res) => {
  try {
    const now = new Date();
    const ambassadorId = req.user.id;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [upcomingShifts, allPayments, activeShift, shiftsNeedingReport, userData, periodReports] = await Promise.all([
      prisma.shift.findMany({
        where: {
          ambassadorId,
          status: { in: ['ASSIGNED', 'CHECKED_IN'] },
          event: { date: { gte: now } },
        },
        include: { event: true },
        orderBy: { event: { date: 'asc' } },
        take: 5,
      }),
      prisma.payment.findMany({ where: { ambassadorId } }),
      prisma.shift.findFirst({
        where: { ambassadorId, status: 'CHECKED_IN' },
        include: { event: true },
      }),
      prisma.shift.findMany({
        where: { ambassadorId, status: 'COMPLETED', report: null },
        include: { event: true },
        orderBy: { checkoutTime: 'desc' },
      }),
      prisma.user.findUnique({
        where: { id: ambassadorId },
        select: { isAvailable: true, lifetimeSalesCount: true },
      }),
      // Reports in current month for commission calc
      prisma.report.findMany({
        where: {
          shift: { ambassadorId },
          submittedAt: { gte: startOfMonth },
        },
        select: { totalSales: true },
      }),
    ]);

    const lifetimeEarnings = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const currentPeriodEarnings = allPayments
      .filter((p) => new Date(p.createdAt) >= startOfMonth)
      .reduce((sum, p) => sum + p.amount, 0);

    // Commission for current month
    const salesThisMonth = periodReports.reduce((s, r) => s + (r.totalSales || 0), 0);
    const lifetimeBefore = Math.max(0, (userData?.lifetimeSalesCount || 0) - salesThisMonth);
    const commissionThisMonth = calcCommission(lifetimeBefore, salesThisMonth);

    res.json({
      upcomingShifts,
      lifetimeEarnings,
      currentPeriodEarnings,
      activeShift,
      shiftsNeedingReport,
      isAvailable: userData?.isAvailable ?? true,
      lifetimeSalesCount: userData?.lifetimeSalesCount || 0,
      commissionThisMonth,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/dashboard/alert
router.post('/alert', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    const ambassadors = await prisma.user.findMany({
      where: { role: 'AMBASSADOR' },
      select: { id: true, phone: true },
    });

    const userIds = ambassadors.map((a) => a.id);
    const phones = ambassadors.filter((a) => a.phone).map((a) => a.phone);

    await Promise.all([
      sendPushNotification(userIds, 'ReBuilt Alert', message),
      sendUrgentAlert(phones, message),
    ]);

    res.json({ success: true, notified: userIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/dashboard/events/:id/metrics — admin enters meal/sales data for an event
router.patch('/events/:id/metrics', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { totalMealsSold, totalSalesInput } = req.body;
    const data = {};
    if (totalMealsSold !== undefined) data.totalMealsSold = parseInt(totalMealsSold) || 0;
    if (totalSalesInput !== undefined) data.totalSalesInput = parseInt(totalSalesInput) || 0;

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data,
      select: { id: true, totalMealsSold: true, totalSalesInput: true },
    });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
