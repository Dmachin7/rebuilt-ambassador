const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const safeUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    if (!rawEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const email = rawEmail.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ token: signToken(user), user: safeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email: rawEmail, password, firstName, lastName, phone, role = 'AMBASSADOR' } = req.body;
    if (!rawEmail || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, password, first and last name are required' });
    }
    const email = rawEmail.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await prisma.user.create({
      data: { email, passwordHash: bcrypt.hashSync(password, 10), firstName, lastName, phone, role },
    });
    res.status(201).json({ token: signToken(user), user: safeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/set-password — used by the welcome email link to let ambassadors set their own password
router.post('/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: { resetToken: hashed, resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) return res.status(400).json({ error: 'This link is invalid or has expired. Ask an admin to resend your welcome email.' });

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: bcrypt.hashSync(password, 10), resetToken: null, resetTokenExpiry: null },
    });
    res.json({ message: 'Password set successfully. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
