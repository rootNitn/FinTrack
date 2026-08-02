import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { getFdRateProvider } from "./providers/fd-rate.provider";
import { calculateFd } from "./fd-calculation.util";
import { ComparisonQuery, CreateFdRateInput, UpdateFdRateInput } from "./fd-rates.dto";

export interface ComparisonRow {
  rank: number;
  bankId: string;
  bankName: string;
  logoUrl: string | null;
  bankType: string;
  interestRate: number;
  seniorCitizenRate: number;
  minDeposit: number;
  maxDeposit: number | null;
  tenureLabel: string;
  compounding: string;
  payoutOptions: string[];
  maturityAmount: number;
  interestEarned: number;
  extraEarned: number;
  rating: number;
  depositInsuranceCover: number;
  lastUpdated: string;
  isHighestMaturity: boolean;
  isHighestRate: boolean;
}

export const fdRatesService = {
  async compareBanks(query: ComparisonQuery) {
    const amount = query.amount ?? 100000;
    const tenureDays = query.tenureDays ?? 365;
    const bankTypes = query.bankTypes ? query.bankTypes.split(",").map((s) => s.trim()) : undefined;

    const banks = await getFdRateProvider().getAllBanks(true);
    const rows: Omit<ComparisonRow, "rank" | "isHighestMaturity" | "isHighestRate">[] = [];

    for (const bank of banks) {
      if (bankTypes && !bankTypes.includes(bank.bankType)) continue;
      if (query.minRating !== undefined && bank.rating < query.minRating) continue;
      if (query.search && !bank.name.toLowerCase().includes(query.search.toLowerCase())) continue;

      const matchingRate = bank.rates.find((r) => tenureDays >= r.tenureMinDays && tenureDays <= r.tenureMaxDays);
      if (!matchingRate) continue;
      if (query.compounding && matchingRate.compounding !== query.compounding) continue;

      const rate = query.fdType === "SENIOR" ? matchingRate.seniorCitizenRate : matchingRate.interestRate;
      const result = calculateFd({
        principal: amount,
        annualRatePercent: rate,
        tenureValue: tenureDays,
        tenureUnit: "DAYS",
        depositType: query.depositType,
        compounding: matchingRate.compounding,
      });

      rows.push({
        bankId: bank.id,
        bankName: bank.name,
        logoUrl: bank.logoUrl,
        bankType: bank.bankType,
        interestRate: matchingRate.interestRate,
        seniorCitizenRate: matchingRate.seniorCitizenRate,
        minDeposit: bank.minDeposit,
        maxDeposit: bank.maxDeposit,
        tenureLabel: matchingRate.tenureLabel,
        compounding: matchingRate.compounding,
        payoutOptions: matchingRate.payoutOptions,
        maturityAmount: result.maturityAmount,
        interestEarned: result.interestEarned,
        extraEarned: result.interestEarned,
        rating: bank.rating,
        depositInsuranceCover: bank.depositInsuranceCover,
        lastUpdated: matchingRate.effectiveDate,
      });
    }

    const sortKey: Record<ComparisonQuery["sortBy"], (r: (typeof rows)[number]) => number | string> = {
      interestRate: (r) => (query.fdType === "SENIOR" ? r.seniorCitizenRate : r.interestRate),
      maturityAmount: (r) => r.maturityAmount,
      bankName: (r) => r.bankName,
      rating: (r) => r.rating,
      tenure: (r) => r.tenureLabel,
    };
    const keyFn = sortKey[query.sortBy];
    rows.sort((a, b) => {
      const av = keyFn(a);
      const bv = keyFn(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return query.sortDir === "asc" ? cmp : -cmp;
    });

    const highestMaturity = Math.max(0, ...rows.map((r) => r.maturityAmount));
    const highestRate = Math.max(0, ...rows.map((r) => (query.fdType === "SENIOR" ? r.seniorCitizenRate : r.interestRate)));

    return rows.map((r, i): ComparisonRow => ({
      ...r,
      rank: i + 1,
      isHighestMaturity: r.maturityAmount === highestMaturity,
      isHighestRate: (query.fdType === "SENIOR" ? r.seniorCitizenRate : r.interestRate) === highestRate,
    }));
  },

  async create(input: CreateFdRateInput) {
    const bank = await prisma.fdBank.findUnique({ where: { id: input.bankId } });
    if (!bank) throw AppError.notFound("Bank not found");
    const rate = await prisma.fdRate.create({ data: input });
    await prisma.fdRateHistory.create({
      data: { bankId: input.bankId, tenureLabel: input.tenureLabel, interestRate: input.interestRate },
    });
    return rate;
  },

  async update(id: string, input: UpdateFdRateInput) {
    const existing = await prisma.fdRate.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Rate not found");
    const rate = await prisma.fdRate.update({ where: { id }, data: input });
    if (input.interestRate !== undefined) {
      await prisma.fdRateHistory.create({
        data: { bankId: existing.bankId, tenureLabel: rate.tenureLabel, interestRate: input.interestRate },
      });
    }
    return rate;
  },

  async remove(id: string) {
    const existing = await prisma.fdRate.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Rate not found");
    await prisma.fdRate.delete({ where: { id } });
  },

  async listByBank(bankId: string) {
    return prisma.fdRate.findMany({ where: { bankId }, orderBy: { tenureMinDays: "asc" } });
  },
};
