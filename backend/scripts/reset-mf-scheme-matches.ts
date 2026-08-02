/**
 * One-off backfill: clears mfSchemeCode/mfSchemeCategory/currentNav for all ACTIVE mutual fund
 * investments that already have a scheme matched, resetting currentValue back to principalAmount.
 *
 * Why: findMatchingScheme() in investment-price-refresh.service.ts previously used an overly
 * permissive recall>=0.8 threshold that could match a completely different fund house (e.g. "HDFC
 * Mid Cap Fund Direct Growth" got matched to a Nippon India scheme). Once matched, the wrong
 * schemeCode was persisted and never reconsidered on subsequent refreshes. This script clears the
 * bad state so the next "Refresh Prices" click re-matches using the corrected, stricter algorithm.
 *
 * Run with: npx tsx scripts/reset-mf-scheme-matches.ts
 */
import { prisma } from "../src/config/prisma";

async function main() {
  const rows = await prisma.investment.findMany({
    where: { category: "MUTUAL_FUNDS", status: "ACTIVE", mfSchemeCode: { not: null } },
    select: { id: true, name: true, principalAmount: true },
  });

  console.log(`Resetting scheme match for ${rows.length} mutual fund investment(s)...`);

  for (const r of rows) {
    await prisma.investment.update({
      where: { id: r.id },
      data: {
        mfSchemeCode: null,
        mfSchemeCategory: null,
        currentNav: null,
        currentValue: r.principalAmount,
        lastPriceRefreshAt: null,
      },
    });
    console.log(`Reset: ${r.name}`);
  }

  console.log("Done. Click 'Refresh Prices' in the app to re-match with the corrected algorithm.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
