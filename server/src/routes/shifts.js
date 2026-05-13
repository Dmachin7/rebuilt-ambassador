const express = require('express');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSMSReminder } = require('../stubs/sms');
const { uploadPhoto } = require('../stubs/storage');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const CHECKIN_RADIUS_METERS = 91.44; // 300 feet

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ReBuilt-Ambassador-Platform/1.0' },
  });
  const data = await res.json();
  if (!data.length) throw new Error('Could not geocode event address');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
    res.json(shifts);
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
    res.json(shifts);
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

    res.json(updated);
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

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/shifts/:id/unassign — admin or event coordinator
router.post('/:id/unassign', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: { ambassadorId: null, status: 'OPEN' },
    });
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

    if (isNaN(ambassadorLat) || isNaN(ambassadorLng)) {
      return res.status(400).json({ error: 'Location is required to check in' });
    }

    const eventCoords = await geocodeAddress(shift.event.location);
    const distance = haversineDistance(ambassadorLat, ambassadorLng, eventCoords.lat, eventCoords.lng);

    if (distance > CHECKIN_RADIUS_METERS) {
      const feet = Math.round(distance * 3.28084);
      return res.status(400).json({
        error: `You are ${feet}ft from the event location. You must be within 300ft to check in.`,
      });
    }

    const photoResult = req.file ? await uploadPhoto(req.file) : { url: null };

    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: {
        checkinTime: new Date(),
        checkinPhotoUrl: photoResult.url,
        status: 'CHECKED_IN',
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/shifts/:id/checkout
router.post('/:id/checkout', verifyToken, async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({ where: { id: req.params.id } });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.ambassadorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not your shift' });
    }
    if (!shift.checkinTime) return res.status(400).json({ error: 'Must check in first' });
    if (shift.checkoutTime) return res.status(400).json({ error: 'Already checked out' });

    const checkoutTime = new Date();
    const hoursWorked = Math.round(((checkoutTime - shift.checkinTime) / 3600000) * 100) / 100;
    const amount = Math.round(hoursWorked * 20 * 100) / 100;

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

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
