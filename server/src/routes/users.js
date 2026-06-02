const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

// GET /api/users — admin or event coordinator
router.get('/', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const { role } = req.query;
    const where = role ? { role } : {};
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true,
        phone: true, isAvailable: true, lifetimeSalesCount: true, createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const isAdminOrCoord = req.user.role === 'ADMIN' || req.user.role === 'EVENT_COORDINATOR';
    if (!isAdminOrCoord && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true,
        phone: true, legalName: true, address: true, isAvailable: true,
        lifetimeSalesCount: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id — update own profile (or admin/coord updates anyone)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const isAdminOrCoord = req.user.role === 'ADMIN' || req.user.role === 'EVENT_COORDINATOR';
    if (!isAdminOrCoord && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { firstName, lastName, phone, legalName, address } = req.body;
    const data = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (phone !== undefined) data.phone = phone;
    if (legalName !== undefined) data.legalName = legalName;
    if (address !== undefined) data.address = address;

    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/:id/availability — ambassador updates own status; admin/coord can update anyone
router.patch('/:id/availability', verifyToken, async (req, res) => {
  try {
    const isAdminOrCoord = req.user.role === 'ADMIN' || req.user.role === 'EVENT_COORDINATOR';
    if (!isAdminOrCoord && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'isAvailable must be a boolean' });
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isAvailable },
      select: { id: true, isAvailable: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id — admin only
router.delete('/:id', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) return res.status(400).json({ error: 'You cannot delete your own account' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Open up any shifts that were assigned but not yet completed
    await prisma.shift.updateMany({
      where: { ambassadorId: id, status: { in: ['ASSIGNED', 'CHECKED_IN'] } },
      data: { ambassadorId: null, status: 'OPEN' },
    });
    // Detach from completed shifts so historical event records remain intact
    await prisma.shift.updateMany({
      where: { ambassadorId: id },
      data: { ambassadorId: null },
    });
    await prisma.payment.deleteMany({ where: { ambassadorId: id } });
    await prisma.message.deleteMany({ where: { senderId: id } });
    await prisma.leaderboardEntry.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    res.json({ message: 'Ambassador removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users — create a Brand Ambassador (admin or coord) or Event Coordinator (admin only)
router.post('/', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const { email: rawEmail, password, firstName, lastName, phone, lifetimeSalesCount, role: requestedRole } = req.body;

    const isCoordinator = requestedRole === 'EVENT_COORDINATOR';
    const isAdmin = requestedRole === 'ADMIN';
    if ((isCoordinator || isAdmin) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can create admin or event coordinator accounts' });
    }
    const role = isAdmin ? 'ADMIN' : isCoordinator ? 'EVENT_COORDINATOR' : 'AMBASSADOR';

    if (!rawEmail || !firstName || !lastName) {
      return res.status(400).json({ error: 'email, firstName, and lastName are required' });
    }
    // Password is required for ambassador creation; auto-generated for coordinator invite flow
    const resolvedPassword = password || (isCoordinator ? crypto.randomBytes(16).toString('hex') : null);
    if (!resolvedPassword) {
      return res.status(400).json({ error: 'password is required' });
    }

    const email = rawEmail.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: bcrypt.hashSync(resolvedPassword, 10),
        firstName,
        lastName,
        phone: phone || null,
        role,
        lifetimeSalesCount: role === 'AMBASSADOR' && typeof lifetimeSalesCount === 'number' && lifetimeSalesCount > 0 ? lifetimeSalesCount : 0,
        resetToken: hashedToken,
        resetTokenExpiry: tokenExpiry,
      },
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true, phone: true, lifetimeSalesCount: true, createdAt: true,
      },
    });

    const setPasswordUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/set-password?token=${rawToken}`;
    sendWelcomeEmail(user, setPasswordUrl).catch((err) => console.error('[WELCOME EMAIL]', err));

    res.status(201).json({ user, plainPassword: resolvedPassword, setPasswordUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
