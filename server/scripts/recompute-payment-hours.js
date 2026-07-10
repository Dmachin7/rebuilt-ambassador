// One-time backfill: Payment.hoursWorked/amount are computed once at checkout and stored, not
// recalculated on read. Payments checked out before the on-site-already-covers-setup fix (see
// server/src/routes/shifts.js) still carry the old, setup-inflated totals. This recomputes every
// non-overridden payment with the corrected formula: hoursWorked = max(MIN_PAID_HOURS, onSiteHours
// + driveTimeHours), no setup addend. Payments with an admin override on any breakdown field are
// left untouched, since those reflect a deliberate manual correction.
//
// Usage: node server/scripts/recompute-payment-hours.js [--dry-run]

const prisma = require('../src/lib/prisma');
const { HOURLY_RATE, MIN_PAID_HOURS } = require('../src/config/constants');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const payments = await prisma.payment.findMany({
    where: {
      onSiteHoursOverride: null,
      driveTimeHoursOverride: null,
    },
    include: { shift: { include: { event: true } } },
  });

  let changed = 0;
  for (const p of payments) {
    if (!p.shift?.checkinTime || !p.shift?.checkoutTime) continue;

    const onSiteHours = (new Date(p.shift.checkoutTime) - new Date(p.shift.checkinTime)) / 3600000;
    const driveHours = (p.shift.event?.driveTimeMins || 0) / 60;
    const hoursWorked = Math.round(Math.max(MIN_PAID_HOURS, onSiteHours + driveHours) * 100) / 100;
    const amount = Math.round(hoursWorked * HOURLY_RATE * 100) / 100;

    if (hoursWorked === p.hoursWorked && amount === p.amount) continue;

    console.log(
      `${dryRun ? '[dry-run] ' : ''}Payment ${p.id}: hoursWorked ${p.hoursWorked} -> ${hoursWorked}, amount ${p.amount} -> ${amount}`
    );
    changed++;

    if (!dryRun) {
      await prisma.payment.update({ where: { id: p.id }, data: { hoursWorked, amount } });
    }
  }

  console.log(`\n${changed} payment(s) ${dryRun ? 'would be' : 'were'} updated out of ${payments.length} checked.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
