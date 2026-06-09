const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { calculateDistanceFromHQ } = require('../stubs/maps');
const { sendPostEventRecapEmail, sendShiftAssignedEmail, sendNewOpenEventEmail } = require('../services/emailService');

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

// POST /api/events — admin or event coordinator
router.post('/', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const {
      title, location, contactName, contactPhone, contactEmail,
      date, endTime, setupTimeMins, breakdownTimeMins, ambassadorsNeeded,
      samplesNeeded, snackBitesNeeded, notes, assignedAmbassadorIds,
    } = req.body;

    if (!title || !location || !date) {
      return res.status(400).json({ error: 'title, location, and date are required' });
    }

    const distance = await calculateDistanceFromHQ(location);
    const totalNeeded = parseInt(ambassadorsNeeded) || 1;

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
        endTime: endTime ? new Date(endTime) : null,
        setupTimeMins: parseInt(setupTimeMins) || 30,
        breakdownTimeMins: parseInt(breakdownTimeMins) || 30,
        ambassadorsNeeded: totalNeeded,
        samplesNeeded: samplesNeeded ? parseInt(samplesNeeded) : null,
        snackBitesNeeded: snackBitesNeeded ? parseInt(snackBitesNeeded) : null,
        notes,
        status: 'UPCOMING',
      },
    });

    const assignedIds = Array.isArray(assignedAmbassadorIds)
      ? assignedAmbassadorIds.filter(Boolean).slice(0, totalNeeded)
      : [];
    const openSlots = totalNeeded - assignedIds.length;

    await Promise.all([
      ...assignedIds.map((ambassadorId) =>
        prisma.shift.create({ data: { eventId: event.id, ambassadorId, status: 'ASSIGNED' } })
      ),
      ...Array.from({ length: openSlots }, () =>
        prisma.shift.create({ data: { eventId: event.id, status: 'OPEN' } })
      ),
    ]);

    const full = await prisma.event.findUnique({
      where: { id: event.id },
      include: { shifts: true },
    });

    // Email assigned ambassadors
    if (assignedIds.length > 0) {
      const assignedUsers = await prisma.user.findMany({
        where: { id: { in: assignedIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      assignedUsers.forEach((amb) => {
        sendShiftAssignedEmail(amb, full, true).catch((err) => console.error('[ASSIGN EMAIL]', err));
      });
    }

    // Email all ambassadors if there are open shifts
    if (openSlots > 0) {
      prisma.user.findMany({ where: { role: 'AMBASSADOR' }, select: { email: true } })
        .then((ambassadors) => {
          const emails = ambassadors.map((u) => u.email);
          if (emails.length > 0) {
            sendNewOpenEventEmail(emails, full, openSlots).catch((err) =>
              console.error('[NEW EVENT EMAIL]', err));
          }
        })
        .catch((err) => console.error('[NEW EVENT NOTIFY]', err));
    }

    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/events/:id — admin or event coordinator
router.put('/:id', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const {
      title, location, contactName, contactPhone, contactEmail,
      date, endTime, setupTimeMins, breakdownTimeMins, ambassadorsNeeded,
      samplesNeeded, snackBitesNeeded, notes, status,
    } = req.body;

    const before = await prisma.event.findUnique({ where: { id: req.params.id }, select: { status: true } });

    const data = {};
    if (title !== undefined) data.title = title;
    if (location !== undefined) data.location = location;
    if (contactName !== undefined) data.contactName = contactName;
    if (contactPhone !== undefined) data.contactPhone = contactPhone;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (date !== undefined) data.date = new Date(date);
    if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;
    if (setupTimeMins !== undefined) data.setupTimeMins = parseInt(setupTimeMins);
    if (breakdownTimeMins !== undefined) data.breakdownTimeMins = parseInt(breakdownTimeMins);
    if (ambassadorsNeeded !== undefined) data.ambassadorsNeeded = parseInt(ambassadorsNeeded);
    if (samplesNeeded !== undefined) data.samplesNeeded = samplesNeeded ? parseInt(samplesNeeded) : null;
    if (snackBitesNeeded !== undefined) data.snackBitesNeeded = snackBitesNeeded ? parseInt(snackBitesNeeded) : null;
    if (notes !== undefined) data.notes = notes;
    if (status !== undefined) data.status = status;

    const event = await prisma.event.update({ where: { id: req.params.id }, data });

    if (status === 'COMPLETED' && before?.status !== 'COMPLETED') {
      const fullEvent = await prisma.event.findUnique({
        where: { id: event.id },
        include: {
          shifts: { include: { ambassador: { select: { firstName: true, lastName: true } } } },
        },
      });
      const staff = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'EVENT_COORDINATOR'] } },
        select: { email: true },
      });
      const staffEmails = staff.map((u) => u.email);
      if (staffEmails.length > 0) {
        sendPostEventRecapEmail(staffEmails, fullEvent, fullEvent.shifts).catch((err) =>
          console.error('[RECAP EMAIL]', err)
        );
      }
    }

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
