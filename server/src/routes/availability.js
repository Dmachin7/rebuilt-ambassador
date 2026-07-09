const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

const VALID_STATUSES = ['OPEN', 'UNAVAILABLE', 'OTHER'];

// Normalizes a date (string or Date) down to a UTC midnight Date so it matches the @db.Date column
function toDateOnly(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function validateDays(days) {
  if (!Array.isArray(days) || days.length === 0) return 'days (non-empty array) is required';
  for (const d of days) {
    if (!d.date) return 'Each day requires a date';
    if (!VALID_STATUSES.includes(d.status)) return `status must be one of ${VALID_STATUSES.join(', ')}`;
  }
  return null;
}

async function upsertDays(userId, days) {
  return Promise.all(
    days.map((d) =>
      prisma.availabilityDay.upsert({
        where: { userId_date: { userId, date: toDateOnly(d.date) } },
        create: { userId, date: toDateOnly(d.date), status: d.status, note: d.note || null },
        update: { status: d.status, note: d.note || null },
      })
    )
  );
}

// GET /api/availability/:userId?start=&end= — ambassador can only fetch their own; admin/EC can fetch any ambassador's
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.id !== userId && !['ADMIN', 'EVENT_COORDINATOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const where = { userId };
    if (req.query.start || req.query.end) {
      where.date = {};
      if (req.query.start) where.date.gte = toDateOnly(req.query.start);
      if (req.query.end) where.date.lte = toDateOnly(req.query.end);
    }
    const days = await prisma.availabilityDay.findMany({ where, orderBy: { date: 'asc' } });
    res.json(days);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/availability — ambassador upserts their own days
router.put('/', verifyToken, requireRole('AMBASSADOR'), async (req, res) => {
  try {
    const error = validateDays(req.body.days);
    if (error) return res.status(400).json({ error });
    const updated = await upsertDays(req.user.id, req.body.days);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/availability/:userId — admin/EC upserts a specific ambassador's days
router.put('/:userId', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const error = validateDays(req.body.days);
    if (error) return res.status(400).json({ error });
    const updated = await upsertDays(req.params.userId, req.body.days);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
