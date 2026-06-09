const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { sendMessageNotificationEmail } = require('../services/emailService');

const router = express.Router();

// GET /api/messages/:eventId
router.get('/:eventId', verifyToken, async (req, res) => {
  try {
    // Ambassadors must be assigned to a shift on this event
    if (req.user.role === 'AMBASSADOR') {
      const shift = await prisma.shift.findFirst({
        where: { eventId: req.params.eventId, ambassadorId: req.user.id },
      });
      if (!shift) return res.status(403).json({ error: 'Not assigned to this event' });
    }

    const messages = await prisma.message.findMany({
      where: { eventId: req.params.eventId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages/:eventId
router.post('/:eventId', verifyToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message content is required' });

    const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const message = await prisma.message.create({
      data: {
        eventId: req.params.eventId,
        senderId: req.user.id,
        content: content.trim(),
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    // Fire-and-forget: email all participants except the sender
    Promise.all([
      prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'EVENT_COORDINATOR'] } },
        select: { id: true, email: true },
      }),
      prisma.shift.findMany({
        where: {
          eventId: req.params.eventId,
          status: { in: ['ASSIGNED', 'CHECKED_IN', 'COMPLETED'] },
          ambassador: { isNot: null },
        },
        include: { ambassador: { select: { id: true, email: true } } },
      }),
    ])
      .then(([staff, shifts]) => {
        const seen = new Set();
        const recipients = [];
        for (const u of [...staff, ...shifts.map((s) => s.ambassador).filter(Boolean)]) {
          if (u.id !== req.user.id && !seen.has(u.email)) {
            seen.add(u.email);
            recipients.push(u.email);
          }
        }
        if (recipients.length > 0) {
          sendMessageNotificationEmail(recipients, message.sender, event, content.trim()).catch((err) =>
            console.error('[MSG EMAIL]', err));
        }
      })
      .catch((err) => console.error('[MSG NOTIFY]', err));

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
