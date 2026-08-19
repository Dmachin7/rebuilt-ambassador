const prisma = require('../lib/prisma');

// Production deploys via `prisma db push` (see package.json's build script), which only syncs
// table structure from schema.prisma — it never executes migration SQL, so seed data written
// into a migration file silently never lands there. This runs at every server boot instead,
// only actually inserting anything the one time the table is empty, so it's safe to run on every
// startup and self-heals if the table is ever found empty again.
const DEFAULT_LOCATIONS = [
  'Burn Boot Camp Brandon',
  'Cigar City CrossFit',
  'F45 Training Lakeland Highlands',
  'F45 Training Riverview',
  'ReBuilt Downstairs Fridge',
  'Neighborly Care Network',
  'Bayshore Fit',
  'Burn Boot Camp South Tampa',
  'CAMP Tampa',
  'Perform24 Tampa',
  'Burg CrossFit Downtown',
  'CrossFit St. Pete',
  'Elevate St. Pete',
  'Sunshine City CrossFit',
  'CrossFit Aero',
  'F45 Training Wiregrass',
  'Fit Body Boot Camp - Lutz',
  'Fit24 Tampa',
  'Anytime Fitness Clearwater',
  'F45 Training Largo East',
  'F45 Training Midtown Tampa',
  'TrYumph Fitness Largo',
  'CAMP Tampa 2nd Delivery',
  'CAMP Tampa 3rd Delivery',
  'Nutrishop South Tampa',
  'Lexus',
  'Anytime Fitness Tarpon Springs',
  'Level Up Westchase',
  'Seven Springs CrossFit',
  'Train Harder CrossFit',
  'Burn Boot Camp Apollo Beach',
  'CrossFit Manatee',
  'F45 Training Sarasota UTC',
  'MAD Nutrition & Smoothies',
  'CrossFit Brooksville',
];

async function seedPickupLocationsIfEmpty() {
  try {
    const count = await prisma.pickupLocation.count();
    if (count > 0) return;
    await prisma.pickupLocation.createMany({
      data: DEFAULT_LOCATIONS.map((name) => ({ name })),
      skipDuplicates: true,
    });
    console.log(`[SEED] Populated ${DEFAULT_LOCATIONS.length} default pickup locations (table was empty)`);
  } catch (err) {
    console.error('[SEED] Failed to seed pickup locations:', err.message);
  }
}

module.exports = { seedPickupLocationsIfEmpty };
