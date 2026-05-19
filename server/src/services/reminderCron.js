const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { sendEventReminderEmail } = require('./emailService');

// Runs every 30 minutes and sends reminder emails for upcoming assigned shifts.
cron.schedule('*/30 * * * *', async () => {
  const now = new Date();

  try {
    // 24-hour reminder: event starts between 23h and 25h from now
    const window24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const window24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const shifts24h = await prisma.shift.findMany({
      where: {
        status: 'ASSIGNED',
        reminder24hSent: false,
        event: { date: { gte: window24hStart, lte: window24hEnd } },
      },
      include: {
        event: true,
        ambassador: true,
      },
    });

    for (const shift of shifts24h) {
      if (!shift.ambassador) continue;
      try {
        await sendEventReminderEmail(shift.ambassador, shift.event, 24);
        await prisma.shift.update({ where: { id: shift.id }, data: { reminder24hSent: true } });
      } catch (err) {
        console.error(`[CRON] 24h reminder failed for shift ${shift.id}:`, err.message);
      }
    }

    // 1-hour reminder: event starts between 45 min and 75 min from now
    const window1hStart = new Date(now.getTime() + 45 * 60 * 1000);
    const window1hEnd = new Date(now.getTime() + 75 * 60 * 1000);

    const shifts1h = await prisma.shift.findMany({
      where: {
        status: 'ASSIGNED',
        reminder1hSent: false,
        event: { date: { gte: window1hStart, lte: window1hEnd } },
      },
      include: {
        event: true,
        ambassador: true,
      },
    });

    for (const shift of shifts1h) {
      if (!shift.ambassador) continue;
      try {
        await sendEventReminderEmail(shift.ambassador, shift.event, 1);
        await prisma.shift.update({ where: { id: shift.id }, data: { reminder1hSent: true } });
      } catch (err) {
        console.error(`[CRON] 1h reminder failed for shift ${shift.id}:`, err.message);
      }
    }

    if (shifts24h.length + shifts1h.length > 0) {
      console.log(`[CRON] Sent ${shifts24h.length} 24h reminder(s), ${shifts1h.length} 1h reminder(s)`);
    }
  } catch (err) {
    console.error('[CRON] Reminder job error:', err.message);
  }
});

console.log('[CRON] Event reminder job scheduled (every 30 min)');
