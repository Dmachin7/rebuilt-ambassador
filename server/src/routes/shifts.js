const express = require('express');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSMSReminder } = require('../stubs/sms');
const { uploadPhoto } = require('../stubs/storage');
const { sendShiftAssignedEmail, sendShiftPickupEmail, sendCheckInNotificationEmail, sendCheckoutNotificationEmail } = require('../services/emailService');
const { geocodeAddress, haversineDistance } = require('../lib/geo');
const { withShiftArrivalTime } = require('../lib/time');
const { MIN_PAID_HOURS, HOURLY_RATE, CHECKIN_RADIUS_FEET, CHECKIN_RADIUS_METERS, CHECKIN_MAX_ACCURACY_GRACE_METERS } = require('../config/constants');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// GET /api/shifts/open
router.get('/open', verifyToken, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      where: { status: 'OPEN' },
      include: {
        event: true,
        ambassador: { select: { id: true, firstName: true, lastName: true, isAvailable: true } },
      },
      orderBy: { event: { date: 'asc' } },
    });
    res.json(shifts.map(withShiftArrivalTime));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/shifts/hours
router.get('/hours', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const groups = await prisma.payment.groupBy({
      by: ['ambassadorId'],
      _sum: { hoursWorked: true, amount: true },
      _count: { id: true },
    });
    const userIds = groups.map((g) => g.ambassadorId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const result = groups.map((g) => ({
      ambassador: users.find((u) => u.id === g.ambassadorId),
      totalHours: g._sum.hoursWorked || 0,
      totalEarnings: g._sum.amount || 0,
      shiftCount: g._count.id,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/shifts
router.get('/', verifyToken, async (req, res) => {
  try {
    const where = req.user.role === 'AMBASSADOR' ? { ambassadorId: req.user.id } : {};
    const shifts = await prisma.shift.findMany({
      where,
      include: {
        event: true,
        ambassador: { select: { id: true, firstName: true, lastName: true, email: true, isAvailable: true } },
        report: true,
        payment: true,
      },
      orderBy: { event: { date: 'asc' } },
    });
    res.json(shifts.map(withShiftArrivalTime));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/shifts/:id/claim
router.post('/:id/claim', verifyToken, requireRole('AMBASSADOR'), async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id: req.params.id },
      include: { event: true },
    });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.status !== 'OPEN') return res.status(400).json({ error: 'Shift is not available' });

    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: { ambassadorId: req.user.id, status: 'ASSIGNED' },
      include: { event: true },
    });

    const ambassador = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (ambassador?.phone) {
      const eventDate = new Date(shift.event.date);
      const hoursUntil = Math.round((eventDate - new Date()) / 3600000);
      await sendSMSReminder(
        ambassador.phone,
        `You've claimed a shift for ${shift.event.title} on ${eventDate.toLocaleDateString()}. See you there!`,
        hoursUntil
      );
    }
    if (ambassador) {
      sendShiftAssignedEmail(ambassador, shift.event, false).catch((err) => console.error('[SHIFT EMAIL]', err));

      prisma.user.findMany({ where: { role: { in: ['ADMIN', 'EVENT_COORDINATOR'] } }, select: { email: true } })
        .then((staff) => {
          const emails = staff.map((u) => u.email);
          if (emails.length > 0) {
            sendShiftPickupEmail(emails, ambassador, shift.event, 'claimed').catch((err) =>
              console.error('[PICKUP EMAIL]', err));
          }
        })
        .catch((err) => console.error('[PICKUP NOTIFY]', err));
    }

    res.json(withShiftArrivalTime(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/shifts/:id/assign — admin or event coordinator
router.post('/:id/assign', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const { ambassadorId } = req.body;
    if (!ambassadorId) return res.status(400).json({ error: 'ambassadorId required' });

    const shift = await prisma.shift.findUnique({
      where: { id: req.params.id },
      include: { event: true },
    });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: { ambassadorId, status: 'ASSIGNED' },
      include: {
        event: true,
        ambassador: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (updated.ambassador?.phone) {
      await sendSMSReminder(
        updated.ambassador.phone,
        `You've been assigned to ${shift.event.title} on ${new Date(shift.event.date).toLocaleDateString()}.`,
        24
      );
    }
    if (updated.ambassador) {
      sendShiftAssignedEmail(updated.ambassador, updated.event, true).catch((err) => console.error('[SHIFT EMAIL]', err));
    }

    res.json(withShiftArrivalTime(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/shifts/:id/unassign — admin or event coordinator
router.post('/:id/unassign', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const before = await prisma.shift.findUnique({
      where: { id: req.params.id },
      include: {
        event: true,
        ambassador: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: { ambassadorId: null, status: 'OPEN' },
    });

    if (before?.ambassador && before?.event) {
      prisma.user.findMany({ where: { role: { in: ['ADMIN', 'EVENT_COORDINATOR'] } }, select: { email: true } })
        .then((staff) => {
          const emails = staff.map((u) => u.email);
          if (emails.length > 0) {
            sendShiftPickupEmail(emails, before.ambassador, before.event, 'dropped').catch((err) =>
              console.error('[DROP EMAIL]', err));
          }
        })
        .catch((err) => console.error('[DROP NOTIFY]', err));
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/shifts/:id/checkin
router.post('/:id/checkin', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id: req.params.id },
      include: { event: true },
    });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.ambassadorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not your shift' });
    }
    if (shift.checkinTime) return res.status(400).json({ error: 'Already checked in' });

    const ambassadorLat = parseFloat(req.body.lat);
    const ambassadorLng = parseFloat(req.body.lng);
    const hasCoords = !isNaN(ambassadorLat) && !isNaN(ambassadorLng);
    const overrideRequested = req.body.locationOverride === 'true' || req.body.locationOverride === true;

    if (!hasCoords && !overrideRequested) {
      return res.status(400).json({ error: 'Location is required to check in' });
    }

    // withinRadius stays false when we have no coords at all (GPS failed on the device) —
    // an override is required in that case, same as being outside the geofence.
    let withinRadius = false;

    if (hasCoords) {
      const eventCoords = await geocodeAddress(shift.event.location);
      const distance = haversineDistance(ambassadorLat, ambassadorLng, eventCoords.lat, eventCoords.lng);

      // Give benefit of the doubt up to the device's own reported GPS accuracy (capped) — phones
      // and especially laptops often report low-confidence locations that can be off by hundreds
      // of feet even when the ambassador is genuinely on-site.
      const reportedAccuracy = parseFloat(req.body.accuracy);
      const accuracyGrace = isNaN(reportedAccuracy) ? 0 : Math.min(reportedAccuracy, CHECKIN_MAX_ACCURACY_GRACE_METERS);
      const effectiveRadius = CHECKIN_RADIUS_METERS + accuracyGrace;

      withinRadius = distance <= effectiveRadius;

      if (!withinRadius && !overrideRequested) {
        const feet = Math.round(distance * 3.28084);
        return res.status(400).json({
          error: `You are ${feet}ft from the event location. You must be within ${CHECKIN_RADIUS_FEET}ft to check in.`,
          distanceFeet: feet,
        });
      }
    }

    const photoResult = req.file ? await uploadPhoto(req.file) : { url: null };

    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: {
        checkinTime: new Date(),
        checkinPhotoUrl: photoResult.url,
        status: 'CHECKED_IN',
        locationOverride: !withinRadius,
      },
    });

    prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } })
      .then(async (admins) => {
        const adminEmails = admins.map((u) => u.email);
        if (adminEmails.length === 0) return;
        const ambassador = await prisma.user.findUnique({
          where: { id: shift.ambassadorId },
          select: { firstName: true, lastName: true, email: true },
        });
        if (ambassador) {
          sendCheckInNotificationEmail(adminEmails, ambassador, shift.event).catch((err) =>
            console.error('[CHECKIN EMAIL]', err));
        }
      })
      .catch((err) => console.error('[CHECKIN NOTIFY]', err));

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/shifts/:id/checkout
router.post('/:id/checkout', verifyToken, async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({ where: { id: req.params.id }, include: { event: true } });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.ambassadorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not your shift' });
    }
    if (!shift.checkinTime) return res.status(400).json({ error: 'Must check in first' });
    if (shift.checkoutTime) return res.status(400).json({ error: 'Already checked out' });

    // On-site hours already covers setup time — ambassadors check in when they arrive to
    // set up, not when selling starts — so setup is not added on top here.
    const checkoutTime = new Date();
    const onSiteHours = (checkoutTime - shift.checkinTime) / 3600000;
    const driveHours = (shift.event.driveTimeMins || 0) / 60; // event.driveTimeMins is already the total round-trip time
    const hoursWorked = Math.round(Math.max(MIN_PAID_HOURS, onSiteHours + driveHours) * 100) / 100;
    const amount = Math.round(hoursWorked * HOURLY_RATE * 100) / 100;

    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: { checkoutTime, status: 'COMPLETED' },
    });

    const existingPayment = await prisma.payment.findUnique({ where: { shiftId: shift.id } });
    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          shiftId: shift.id,
          ambassadorId: shift.ambassadorId,
          hoursWorked,
          amount,
          status: 'PENDING',
        },
      });
    }

    prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } })
      .then(async (admins) => {
        const adminEmails = admins.map((u) => u.email);
        if (adminEmails.length === 0) return;
        const ambassador = await prisma.user.findUnique({
          where: { id: shift.ambassadorId },
          select: { firstName: true, lastName: true, email: true },
        });
        if (ambassador) {
          sendCheckoutNotificationEmail(adminEmails, ambassador, shift.event, hoursWorked, amount).catch((err) =>
            console.error('[CHECKOUT EMAIL]', err));
        }
      })
      .catch((err) => console.error('[CHECKOUT NOTIFY]', err));

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
