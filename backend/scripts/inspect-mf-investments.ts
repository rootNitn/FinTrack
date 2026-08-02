import { prisma } from "../src/config/prisma";

async function main() {
  const rows = await prisma.investment.findMany({
    where: { category: "MUTUAL_FUNDS" },
    select: {
      id: true,
      userId: true,
      name: true,
      units: true,
      purchaseNav: true,
      currentNav: true,
      principalAmount: true,
      currentValue: true,
      purchaseDate: true,
      lastPriceRefreshAt: true,
      transactionType: true,
      status: true,
      source: true,
      mfSchemeCode: true,
    },
    orderBy: { purchaseDate: "asc" },
  });
  console.log(`Total MUTUAL_FUNDS rows: ${rows.length}`);
  for (const r of rows) {
    console.log(
      JSON.stringify({
        name: r.name,
        units: r.units?.toString(),
        purchaseNav: r.purchaseNav?.toString(),
        currentNav: r.currentNav?.toString(),
        principal: r.principalAmount?.toString(),
        currentValue: r.currentValue?.toString(),
        purchaseDate: r.purchaseDate.toISOString().slice(0, 10),
        lastPriceRefreshAt: r.lastPriceRefreshAt?.toISOString() ?? null,
        transactionType: r.transactionType,
        status: r.status,
        source: r.source,
        schemeCode: r.mfSchemeCode,
      })
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
