/* eslint-disable no-console */
// Standalone seed script for the Capital Gains Calculator (Phase 3) — Cost Inflation Index values
// and per-asset-type/term capital gains tax rules. Safe to re-run (upsert-based). Run with:
// tsx prisma/seed-capital-gains.ts
import { PrismaClient, CapitalGainAssetType, CapitalGainTermType } from "@prisma/client";

const prisma = new PrismaClient();

// Published CBDT Cost Inflation Index values (base year 2001-02 = 100).
const CII_VALUES: { year: string; ciiValue: number }[] = [
  { year: "2015-16", ciiValue: 254 },
  { year: "2016-17", ciiValue: 264 },
  { year: "2017-18", ciiValue: 272 },
  { year: "2018-19", ciiValue: 280 },
  { year: "2019-20", ciiValue: 289 },
  { year: "2020-21", ciiValue: 301 },
  { year: "2021-22", ciiValue: 317 },
  { year: "2022-23", ciiValue: 331 },
  { year: "2023-24", ciiValue: 348 },
  { year: "2024-25", ciiValue: 363 },
  { year: "2025-26", ciiValue: 376 },
];

interface RuleInput {
  assetType: CapitalGainAssetType;
  termType: CapitalGainTermType;
  ratePercent: number;
  exemptionLimit: number | null;
  indexationAllowed: boolean;
}

/** Simplified capital-gains rate table (documented assumption — see PROJECT_OVERVIEW.md):
 * equity (STOCK/MUTUAL_FUND, treated as equity-oriented) STCG 20% / LTCG 12.5% with a ₹1,25,000/yr
 * exemption and no indexation; PROPERTY/GOLD LTCG 12.5% WITH indexation (pre-Budget-2024 rule,
 * kept for the indexation feature); PROPERTY/GOLD STCG a flat 30% placeholder (real law adds it to
 * slab income); CRYPTO flat 30% regardless of holding period (Sec 115BBH, no LTCG concept). */
const RULES: RuleInput[] = [
  { assetType: "STOCK", termType: "SHORT", ratePercent: 20, exemptionLimit: null, indexationAllowed: false },
  { assetType: "STOCK", termType: "LONG", ratePercent: 12.5, exemptionLimit: 125000, indexationAllowed: false },
  { assetType: "MUTUAL_FUND", termType: "SHORT", ratePercent: 20, exemptionLimit: null, indexationAllowed: false },
  { assetType: "MUTUAL_FUND", termType: "LONG", ratePercent: 12.5, exemptionLimit: 125000, indexationAllowed: false },
  { assetType: "PROPERTY", termType: "SHORT", ratePercent: 30, exemptionLimit: null, indexationAllowed: false },
  { assetType: "PROPERTY", termType: "LONG", ratePercent: 12.5, exemptionLimit: null, indexationAllowed: true },
  { assetType: "GOLD", termType: "SHORT", ratePercent: 30, exemptionLimit: null, indexationAllowed: false },
  { assetType: "GOLD", termType: "LONG", ratePercent: 12.5, exemptionLimit: null, indexationAllowed: true },
  { assetType: "CRYPTO", termType: "SHORT", ratePercent: 30, exemptionLimit: null, indexationAllowed: false },
  { assetType: "CRYPTO", termType: "LONG", ratePercent: 30, exemptionLimit: null, indexationAllowed: false },
];

async function main() {
  for (const cii of CII_VALUES) {
    await prisma.costInflationIndex.upsert({
      where: { year: cii.year },
      update: { ciiValue: cii.ciiValue },
      create: cii,
    });
  }
  console.log(`Seeded ${CII_VALUES.length} Cost Inflation Index rows.`);

  for (const rule of RULES) {
    await prisma.taxCapitalGainRule.upsert({
      where: { assetType_termType: { assetType: rule.assetType, termType: rule.termType } },
      update: {
        ratePercent: rule.ratePercent,
        exemptionLimit: rule.exemptionLimit,
        indexationAllowed: rule.indexationAllowed,
      },
      create: rule,
    });
  }
  console.log(`Seeded ${RULES.length} Tax Capital Gain rules.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
