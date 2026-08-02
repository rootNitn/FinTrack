/**
 * One-off backfill: broker-imported SELL/redemption rows were previously created with
 * status "ACTIVE", causing the live price refresh to keep re-valuing already-sold units at
 * today's NAV (inflating "Current Value"). This marks existing imported SELL rows as "SOLD"
 * so they're excluded from price refresh and current-value totals going forward.
 * Run once via: npx tsx scripts/backfill-sold-imports.ts
 */
import { prisma } from "../src/config/prisma";

async function main() {
  const result = await prisma.investment.updateMany({
    where: {
      status: "ACTIVE",
      transactionType: { contains: "SELL", mode: "insensitive" },
    },
    data: { status: "SOLD" },
  });
  console.log(`Updated ${result.count} imported SELL row(s) from ACTIVE to SOLD.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
