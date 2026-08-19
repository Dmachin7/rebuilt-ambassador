const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/pickup-locations — anyone signed in (populates the event form's picker)
router.get('/', verifyToken, async (req, res) => {
  try {
    const locations = await prisma.pickupLocation.findMany({ orderBy: { name: 'asc' } });
    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/pickup-locations — admin or event coordinator
router.post('/', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const existing = await prisma.pickupLocation.findUnique({ where: { name } });
    if (existing) return res.status(409).json({ error: 'That location already exists' });

    const location = await prisma.pickupLocation.create({ data: { name } });
    res.status(201).json(location);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/pickup-locations/:id — admin or event coordinator. Event.pickupLocation stores the
// plain string, not a foreign key to this table, so a rename here also updates every event
// currently using the old name — otherwise the fix would only apply to future picks.
router.put('/:id', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const current = await prisma.pickupLocation.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Pickup location not found' });

    const existing = await prisma.pickupLocation.findUnique({ where: { name } });
    if (existing && existing.id !== req.params.id) {
      return res.status(409).json({ error: 'That location already exists' });
    }

    const [location] = await prisma.$transaction([
      prisma.pickupLocation.update({ where: { id: req.params.id }, data: { name } }),
      prisma.event.updateMany({ where: { pickupLocation: current.name }, data: { pickupLocation: name } }),
    ]);
    res.json(location);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/pickup-locations/:id — admin or event coordinator. Only removes it from future
// picks; events already using this location keep the text as-is (again, not a foreign key).
router.delete('/:id', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    await prisma.pickupLocation.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Pickup location not found' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
