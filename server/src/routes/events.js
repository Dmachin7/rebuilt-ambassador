const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { calculateDistanceFromHQ } = require('../stubs/maps');

const router = express.Router();

// GET /api/events
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    const events = await prisma.event.findMany({
      where,
      include: {
        shifts: {
          include: {
            ambassador: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        _count: { select: { shifts: true, messages: true } },
      },
      orderBy: { date: 'asc' },
    });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/events/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        shifts: {
          include: {
            ambassador: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            report: true,
            payment: true,
          },
        },
        messages: {
          include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events — admin only
router.post('/', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const {
      title, location, contactName, contactPhone, contactEmail,
      date, setupTimeMins, breakdownTimeMins, ambassadorsNeeded, samplesNeeded, notes,
    } = req.body;

    if (!title || !location || !date) {
      return res.status(400).json({ error: 'title, location, and date are required' });
    }

    const distance = await calculateDistanceFromHQ(location);

    const event = await prisma.event.create({
      data: {
        title,
        location,
        milesFromHq: distance.miles,
        driveTimeMins: distance.driveTimeMins,
        contactName,
        contactPhone,
        contactEmail,
        date: new Date(date),
        setupTimeMins: parseInt(setupTimeMins) || 30,
        breakdownTimeMins: parseInt(breakdownTimeMins) || 30,
        ambassadorsNeeded: parseInt(ambassadorsNeeded) || 1,
        samplesNeeded: samplesNeeded ? parseInt(samplesNeeded) : null,
        notes,
        status: 'UPCOMING',
      },
    });

    // Auto-create OPEN shifts equal to ambassadorsNeeded
    await Promise.all(
      Array.from({ length: event.ambassadorsNeeded }, () =>
        prisma.shift.create({ data: { eventId: event.id, status: 'OPEN' } })
      )
    );

    const full = await prisma.event.findUnique({
      where: { id: event.id },
      include: { shifts: true },
    });
    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/events/:id — admin only
router.put('/:id', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const {
      title, location, contactName, contactPhone, contactEmail,
      date, setupTimeMins, breakdownTimeMins, ambassadorsNeeded, samplesNeeded, notes, status,
    } = req.body;

    const data = {};
    if (title !== undefined) data.title = title;
    if (location !== undefined) data.location = location;
    if (contactName !== undefined) data.contactName = contactName;
    if (contactPhone !== undefined) data.contactPhone = contactPhone;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (date !== undefined) data.date = new Date(date);
    if (setupTimeMins !== undefined) data.setupTimeMins = parseInt(setupTimeMins);
    if (breakdownTimeMins !== undefined) data.breakdownTimeMins = parseInt(breakdownTimeMins);
    if (ambassadorsNeeded !== undefined) data.ambassadorsNeeded = parseInt(ambassadorsNeeded);
    if (samplesNeeded !== undefined) data.samplesNeeded = samplesNeeded ? parseInt(samplesNeeded) : null;
    if (notes !== undefined) data.notes = notes;
    if (status !== undefined) data.status = status;

    const event = await prisma.event.update({ where: { id: req.params.id }, data });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/events/:id — admin only
router.delete('/:id', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
