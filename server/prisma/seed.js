// Full reset seed — wipes ALL data and recreates from scratch.
// Edit the constants at the top, then run:
//   cd server && npx prisma db push --force-reset && node prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ── EDIT THESE BEFORE RUNNING ────────────────────────────────────────────────
const ARTHUR_EMAIL = 'YOUR_ADMIN_EMAIL_HERE';
const ARTHUR_PASSWORD = 'YOUR_TEMP_PASSWORD_HERE';
const ARTHUR_FIRST = 'Arthur';
const ARTHUR_LAST = '';
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.leaderboardEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      email: ARTHUR_EMAIL.toLowerCase().trim(),
      passwordHash: bcrypt.hashSync(ARTHUR_PASSWORD, 10),
      role: 'ADMIN',
      firstName: ARTHUR_FIRST,
      lastName: ARTHUR_LAST,
      isAvailable: true,
      lifetimeSalesCount: 0,
    },
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log(`   Admin: ${ARTHUR_EMAIL} / ${ARTHUR_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
