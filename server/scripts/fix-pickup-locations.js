// One-time backfill: the pickup-location dropdown (client/src/components/EventFormModal.jsx)
// was corrected for typos/casing and a couple of renames, but that only affects new selections —
// events already saved with the old text keep it forever unless corrected here. This finds every
// Event whose pickupLocation exactly matches an old value and updates it to the corrected one.
//
// Safe to run more than once — once an event is corrected, it no longer matches any old value.
//
// Usage: node server/scripts/fix-pickup-locations.js [--dry-run]
// Run --dry-run FIRST to see exactly what would change before applying it for real.

const prisma = require('../src/lib/prisma');

const dryRun = process.argv.includes('--dry-run');

// Old (pre-fix) value -> corrected value. Only entries that actually changed are listed —
// anything unchanged between the old and new dropdown lists needs no mapping.
const CORRECTIONS = {
  'Rebuilt Downstairs Fridge': 'ReBuilt Downstairs Fridge',
  'Camp Tampa': 'CAMP Tampa',
  'NOEQL': 'Cigar City CrossFit', // confirmed directly by the user
  'CrosssFit St. Pete': 'CrossFit St. Pete',
  'F45 Wiregrass': 'F45 Training Wiregrass',
  'F45 Midtown Tampa': 'F45 Training Midtown Tampa',
  'F45 Training Lakeland Heights': 'F45 Training Lakeland Highlands',
  'Perform24': 'Perform24 Tampa',
  'Seven Springs Crossfit': 'Seven Springs CrossFit',
  'crossfit AERO': 'CrossFit Aero',
  'TrYumph Fitness': 'TrYumph Fitness Largo',
  'Sunshine City Crossfit': 'Sunshine City CrossFit',
  // Best-guess match, not explicitly confirmed — same South Tampa nutrition/smoothie shop,
  // just corrected from what looks like a typo of the actual name. Double-check this one.
  'MAXX Nutrition & Smoothies': 'MAD Nutrition & Smoothies',
};

async function main() {
  let totalChanged = 0;

  for (const [oldValue, newValue] of Object.entries(CORRECTIONS)) {
    const matches = await prisma.event.findMany({
      where: { pickupLocation: oldValue },
      select: { id: true, title: true, date: true },
    });

    if (matches.length === 0) continue;

    console.log(`\n"${oldValue}" -> "${newValue}" (${matches.length} event${matches.length !== 1 ? 's' : ''})`);
    matches.forEach((e) => {
      console.log(`  ${dryRun ? '[dry-run] ' : ''}${e.title} — ${new Date(e.date).toISOString().split('T')[0]}`);
    });
    totalChanged += matches.length;

    if (!dryRun) {
      await prisma.event.updateMany({
        where: { pickupLocation: oldValue },
        data: { pickupLocation: newValue },
      });
    }
  }

  console.log(`\n${totalChanged} event(s) ${dryRun ? 'would be' : 'were'} updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
