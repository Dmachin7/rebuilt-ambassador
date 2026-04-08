const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/leaderboard?month=3&year=2026
router.get('/', verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    const entries = await prisma.leaderboardEntry.findMany({
      where: { month, year },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { totalPoints: 'desc' },
    });

    const ranked = entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
    res.json({ month, year, entries: ranked });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/leaderboard/recalculate — admin triggers a recalculation
router.post('/recalculate', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.body.month) || now.getMonth() + 1;
    const year = parseInt(req.body.year) || now.getFullYear();

    const entries = await prisma.leaderboardEntry.findMany({ where: { month, year } });

    const calcPoints = (e) => {
      const consistency = e.promosWorked >= 15 ? 10 + (e.promosWorked - 15) : 0;
      const quality =
        e.avgMealsPerSale >= 9 ? 15 :
        e.avgMealsPerSale >= 8 ? 10 :
        e.avgMealsPerSale >= 7 ? 7 : 0;
      return (
        consistency +
        e.noZeroSalePromos * 5 +
        e.strongPerformance * 7 +
        e.weeklyBenchmarks * 15 -
        e.retentionPenalty * 2 +
        quality
      );
    };

    await Promise.all(
      entries.map((e) =>
        prisma.leaderboardEntry.update({
          where: { id: e.id },
          data: { totalPoints: calcPoints(e) },
        })
      )
    );

    res.json({ message: `Recalculated ${entries.length} entries for ${month}/${year}` });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
