const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

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

// POST /api/users — create a new Brand Ambassador (admin or event coordinator)
router.post('/', verifyToken, requireRole('ADMIN', 'EVENT_COORDINATOR'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'email, password, firstName, and lastName are required' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: bcrypt.hashSync(password, 10),
        firstName,
        lastName,
        phone: phone || null,
        role: 'AMBASSADOR',
      },
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true, phone: true, createdAt: true,
      },
    });
    // Return the plain-text password once so the caller can display / email it
    res.status(201).json({ user, plainPassword: password });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
