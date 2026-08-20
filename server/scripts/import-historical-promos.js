// One-time backfill: imports the team's pre-app promo-tracking spreadsheet
// (server/scripts/data/promo_brand_ambassador.csv) into HistoricalPromo rows, so old promos show
// up in the Analytics > Promo Log report and fold into ambassador lifetime stats. See
// HistoricalPromo in schema.prisma for why this is a separate table from Event/Shift.
//
// The CSV only has "M/D" dates with no year, so the year is inferred from month: this
// spreadsheet's log runs Sep 2025 -> Aug 2026 (confirmed by its own "January 2026" summary
// table header), so Sep-Dec -> 2025, Jan-Aug -> 2026. This mapping is hardcoded to THIS import
// and isn't meant to be reused for a different date range.
//
// A promo row with a combined name ("Arthur/Melissa") means two people worked it together — the
// spreadsheet logged one shared row, but this splits it into one HistoricalPromo per person (each
// gets the full hours/sales/meals for that promo), matching how the live app credits a shared
// event to each ambassador's own shift/report rather than splitting the totals.
//
// Ambassador matching is by first name (case-insensitive) against real AMBASSADOR accounts in
// whatever DATABASE_URL this runs against. Anything that doesn't match is still imported —
// ambassadorId is left null and the raw CSV name is kept in ambassadorName — but is called out
// in the summary so it can be fixed manually (rename the account, or re-run after creating it).
//
// Safe to run more than once: an already-imported row (same ambassadorName + promoName + date)
// is skipped.
//
// Usage: DATABASE_URL="postgres://..." node server/scripts/import-historical-promos.js [--dry-run]
// Run --dry-run FIRST and review the summary before running for real.

const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');

const dryRun = process.argv.includes('--dry-run');
const CSV_PATH = path.join(__dirname, 'data', 'promo_brand_ambassador.csv');

function yearForMonth(month) {
  return month >= 9 ? 2025 : 2026;
}

function parseDate(mdStr) {
  const [m, d] = mdStr.split('/').map((n) => parseInt(n, 10));
  const year = yearForMonth(m);
  return new Date(Date.UTC(year, m - 1, d));
}

function parseCsv() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split('\n').slice(1); // skip header row

  const parsed = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const repField = (cols[0] || '').trim();
    const promoName = (cols[1] || '').trim();
    const dateStr = (cols[2] || '').trim();
    const hours = parseFloat(cols[3]);
    const sales = parseInt(cols[4], 10);
    const meals = parseInt(cols[5], 10);

    // Rows with no rep/promo/date are blank in the log block (the CSV has unrelated summary
    // tables pasted into columns further right on some of these lines) — skip them.
    if (!repField || !promoName || !dateStr) continue;

    const names = repField.split('/').map((n) => n.trim()).filter(Boolean);
    for (const name of names) {
      parsed.push({
        ambassadorName: name,
        promoName,
        date: parseDate(dateStr),
        hoursWorked: Number.isFinite(hours) ? hours : 0,
        salesCount: Number.isFinite(sales) ? sales : 0,
        mealsSold: Number.isFinite(meals) ? meals : 0,
      });
    }
  }
  return parsed;
}

async function main() {
  const rows = parseCsv();
  console.log(`Parsed ${rows.length} promo-log row(s) from CSV (after splitting shared promos).`);

  // Match against every role, not just AMBASSADOR — some promo rows belong to admins/ECs who
  // also work promos personally (e.g. Arthur, Brandon). Where one first name has more than one
  // account (e.g. two "Mia" accounts — an EVENT_COORDINATOR and an AMBASSADOR), prefer AMBASSADOR
  // since these rows are logged promo work, then EVENT_COORDINATOR, then ADMIN.
  const allUsers = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  const rolePriority = { AMBASSADOR: 0, EVENT_COORDINATOR: 1, ADMIN: 2 };
  const byFirstName = new Map();
  for (const u of allUsers) {
    const key = u.firstName.trim().toLowerCase();
    const existing = byFirstName.get(key);
    if (!existing || rolePriority[u.role] < rolePriority[existing.role]) {
      byFirstName.set(key, u);
    }
  }

  const unmatched = new Set();
  let inserted = 0;
  let skippedDuplicate = 0;

  for (const row of rows) {
    const match = byFirstName.get(row.ambassadorName.toLowerCase());
    if (!match) unmatched.add(row.ambassadorName);

    // Keyed on the full row, not just name+promo+date — a handful of people worked the same
    // promo twice in one day (different time blocks), which would otherwise collide and get
    // wrongly dropped as a duplicate re-run.
    const existing = await prisma.historicalPromo.findFirst({
      where: {
        ambassadorName: row.ambassadorName,
        promoName: row.promoName,
        date: row.date,
        hoursWorked: row.hoursWorked,
        salesCount: row.salesCount,
        mealsSold: row.mealsSold,
      },
      select: { id: true },
    });
    if (existing) {
      skippedDuplicate += 1;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] ${row.date.toISOString().split('T')[0]}  ${row.ambassadorName.padEnd(10)} ${row.promoName} — ` +
          `${row.hoursWorked}h, ${row.salesCount} sales, ${row.mealsSold} meals` +
          `${match ? '' : '  (UNMATCHED — no account)'}`
      );
    } else {
      await prisma.historicalPromo.create({
        data: {
          ambassadorId: match ? match.id : null,
          ambassadorName: row.ambassadorName,
          promoName: row.promoName,
          date: row.date,
          hoursWorked: row.hoursWorked,
          salesCount: row.salesCount,
          mealsSold: row.mealsSold,
        },
      });
    }
    inserted += 1;
  }

  console.log(`\n${inserted} row(s) ${dryRun ? 'would be' : 'were'} imported.`);
  console.log(`${skippedDuplicate} row(s) skipped (already imported).`);
  if (unmatched.size > 0) {
    console.log(`\nUnmatched ambassador names (imported with no linked account — review these):`);
    [...unmatched].sort().forEach((n) => console.log(`  - ${n}`));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
