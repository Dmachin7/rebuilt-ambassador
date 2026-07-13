const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { withArrivalTime } = require('../lib/time');
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
    res.json(events.map(withArrivalTime));
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
    res.json(withArrivalTime(event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events — admin or event coordinator
router.post('/', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const {
      title, location, pickupLocation, contactName, contactPhone, contactEmail,
      date, endTime, setupTimeMins, breakdownTimeMins, ambassadorsNeeded,
      samplesNeeded, snackBitesNeeded, notes, assignedAmbassadorIds,
      milesFromHq, driveTimeMins,
    } = req.body;

    if (!title || !location || !date) {
      return res.status(400).json({ error: 'title, location, and date are required' });
    }

    // Miles/drive time are entered manually as round-trip totals — no auto-calculation
    const miles = parseFloat(milesFromHq);
    const driveMins = parseInt(driveTimeMins);
    if (milesFromHq === undefined || driveTimeMins === undefined || Number.isNaN(miles) || Number.isNaN(driveMins) || miles < 0 || driveMins < 0) {
      return res.status(400).json({ error: 'milesFromHq and driveTimeMins (round-trip total) are required and must be non-negative numbers' });
    }
    const totalNeeded = parseInt(ambassadorsNeeded) || 1;

    const event = await prisma.event.create({
      data: {
        title,
        location,
        pickupLocation: pickupLocation || null,
        milesFromHq: miles,
        driveTimeMins: driveMins,
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

    res.status(201).json(withArrivalTime(full));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/events/:id — admin or event coordinator
router.put('/:id', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const {
      title, location, pickupLocation, contactName, contactPhone, contactEmail,
      date, endTime, setupTimeMins, breakdownTimeMins, ambassadorsNeeded,
      samplesNeeded, snackBitesNeeded, notes, status,
      milesFromHq, driveTimeMins,
    } = req.body;

    const before = await prisma.event.findUnique({ where: { id: req.params.id }, select: { status: true } });

    const data = {};
    if (title !== undefined) data.title = title;
    if (location !== undefined) data.location = location;
    if (pickupLocation !== undefined) data.pickupLocation = pickupLocation || null;
    // Miles/drive time from HQ are entered manually — no auto-calculation, and independent
    // of whether the location itself changed.
    if (milesFromHq !== undefined) {
      const miles = parseFloat(milesFromHq);
      if (Number.isNaN(miles) || miles < 0) {
        return res.status(400).json({ error: 'milesFromHq must be a non-negative number' });
      }
      data.milesFromHq = miles;
    }
    if (driveTimeMins !== undefined) {
      const driveMins = parseInt(driveTimeMins);
      if (Number.isNaN(driveMins) || driveMins < 0) {
        return res.status(400).json({ error: 'driveTimeMins must be a non-negative number' });
      }
      data.driveTimeMins = driveMins;
    }
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

    res.json(withArrivalTime(event));
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
