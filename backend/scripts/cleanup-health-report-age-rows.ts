/**
 * One-off cleanup for HealthReportResult rows that were misparsed from a patient
 * "NN Years / Gender" line (fixed in lab-report.parser.ts) — deletes the bad rows.
 * Run with: npx tsx scripts/cleanup-health-report-age-rows.ts
 */
import { prisma } from "../src/config/prisma";

const AGE_GENDER_TEST_NAME = /^years?\s*\/\s*(male|female|other)$/i;

async function main() {
  const bad = await prisma.healthReportResult.findMany({
    where: { testName: { in: ["Years / Male", "Years / Female", "Years / Other", "Year / Male", "Year / Female", "Year / Other"] } },
  });

  const extraMatches = (
    await prisma.healthReportResult.findMany({ select: { id: true, testName: true } })
  ).filter((r) => AGE_GENDER_TEST_NAME.test(r.testName));

  const idsToDelete = new Set([...bad.map((r) => r.id), ...extraMatches.map((r) => r.id)]);

  if (idsToDelete.size === 0) {
    console.log("No bad age/gender rows found.");
    return;
  }

  const result = await prisma.healthReportResult.deleteMany({
    where: { id: { in: [...idsToDelete] } },
  });
  console.log(`Deleted ${result.count} misparsed age/gender rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
