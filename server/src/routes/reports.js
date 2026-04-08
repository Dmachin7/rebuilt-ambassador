const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/reports — ADMIN only
router.get('/', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { eventId } = req.query;
    const where = eventId ? { shift: { eventId } } : {};
    const reports = await prisma.report.findMany({
      where,
      include: {
        shift: {
          include: {
            event: true,
            ambassador: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/mine — ambassador's own reports
router.get('/mine', verifyToken, requireRole('AMBASSADOR'), async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      where: { shift: { ambassadorId: req.user.id } },
      include: { shift: { include: { event: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reports
router.post('/', verifyToken, async (req, res) => {
  try {
    const { shiftId, feedback, issues, mealsSold, totalSales } = req.body;
    if (!shiftId || !feedback) {
      return res.status(400).json({ error: 'shiftId and feedback are required' });
    }

    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.ambassadorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not your shift' });
    }

    const existing = await prisma.report.findUnique({ where: { shiftId } });
    if (existing) return res.status(409).json({ error: 'Report already submitted for this shift' });

    const parsedMealsSold = parseInt(mealsSold) || 0;
    const parsedTotalSales = parseInt(totalSales) || 0;
    const mealsPerSale =
      parsedTotalSales > 0
        ? Math.round((parsedMealsSold / parsedTotalSales) * 100) / 100
        : null;

    const report = await prisma.report.create({
      data: {
        shiftId,
        feedback,
        issues: issues || null,
        mealsSold: parsedMealsSold,
        totalSales: parsedTotalSales,
        mealsPerSale,
      },
    });

    // Increment ambassador's lifetime sales count
    if (shift.ambassadorId && parsedTotalSales > 0) {
      await prisma.user.update({
        where: { id: shift.ambassadorId },
        data: { lifetimeSalesCount: { increment: parsedTotalSales } },
      });
    }

    res.status(201).json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
