import { prisma } from "../src/config/prisma";

/** One-off script to mark the two recurring-investment-suggestion tickets as RESOLVED now that
 * the feature has been implemented. Run with: `npx tsx scripts/resolve-recurring-investment-tickets.ts` */
async function main() {
  const response =
    "Implemented: investments now support recurring (weekly/monthly/yearly) auto-buy, mirroring recurring income/expense. " +
    "Enable it via the 'Recurring investment' checkbox on the investment form.";

  const result = await prisma.supportTicket.updateMany({
    where: { id: { in: ["e00d50a5-db9c-4b9c-ae17-3bc2cbb38fc6", "655a75ba-67d8-4951-bfde-35985f0e7623"] } },
    data: { status: "RESOLVED", adminResponse: response },
  });

  console.log(`Updated ${result.count} ticket(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
