import { FdBankType, FdCompoundingFrequency } from "@prisma/client";
import { prisma } from "../../../config/prisma";

/** Bank + rate data shape the rest of the FD module consumes, independent of its source. */
export interface FdRateProviderBank {
  id: string;
  name: string;
  logoUrl: string | null;
  bankType: FdBankType;
  rating: number;
  minDeposit: number;
  maxDeposit: number | null;
  depositInsuranceCover: number;
  isActive: boolean;
  rates: {
    id: string;
    tenureLabel: string;
    tenureMinDays: number;
    tenureMaxDays: number;
    interestRate: number;
    seniorCitizenRate: number;
    compounding: FdCompoundingFrequency;
    payoutOptions: string[];
    effectiveDate: string;
  }[];
}

/**
 * Abstraction over "where FD bank/rate data comes from". Today this is backed entirely by
 * Postgres via Prisma (rates maintained through the admin panel / CSV import). In the future
 * this same interface can be implemented by a `LiveFdRateProvider` that fetches from a live
 * rates API or a scheduled ingestion job — no consuming code (services/controllers/UI) would
 * need to change, only which provider is wired up in `getFdRateProvider()`.
 */
export interface FdRateProvider {
  getAllBanks(activeOnly?: boolean): Promise<FdRateProviderBank[]>;
  getBankById(bankId: string): Promise<FdRateProviderBank | null>;
}

function toProviderBank(bank: {
  id: string;
  name: string;
  logoUrl: string | null;
  bankType: FdBankType;
  rating: number;
  minDeposit: unknown;
  maxDeposit: unknown;
  depositInsuranceCover: unknown;
  isActive: boolean;
  rates: {
    id: string;
    tenureLabel: string;
    tenureMinDays: number;
    tenureMaxDays: number;
    interestRate: unknown;
    seniorCitizenRate: unknown;
    compounding: FdCompoundingFrequency;
    payoutOptions: string[];
    effectiveDate: Date;
  }[];
}): FdRateProviderBank {
  return {
    id: bank.id,
    name: bank.name,
    logoUrl: bank.logoUrl,
    bankType: bank.bankType,
    rating: bank.rating,
    minDeposit: Number(bank.minDeposit),
    maxDeposit: bank.maxDeposit !== null ? Number(bank.maxDeposit) : null,
    depositInsuranceCover: Number(bank.depositInsuranceCover),
    isActive: bank.isActive,
    rates: bank.rates.map((r) => ({
      id: r.id,
      tenureLabel: r.tenureLabel,
      tenureMinDays: r.tenureMinDays,
      tenureMaxDays: r.tenureMaxDays,
      interestRate: Number(r.interestRate),
      seniorCitizenRate: Number(r.seniorCitizenRate),
      compounding: r.compounding,
      payoutOptions: r.payoutOptions,
      effectiveDate: r.effectiveDate.toISOString(),
    })),
  };
}

/** Default provider: reads current bank + rate data from Postgres via Prisma. */
export class PrismaFdRateProvider implements FdRateProvider {
  async getAllBanks(activeOnly = true): Promise<FdRateProviderBank[]> {
    const banks = await prisma.fdBank.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { rates: true },
      orderBy: { name: "asc" },
    });
    return banks.map(toProviderBank);
  }

  async getBankById(bankId: string): Promise<FdRateProviderBank | null> {
    const bank = await prisma.fdBank.findUnique({ where: { id: bankId }, include: { rates: true } });
    return bank ? toProviderBank(bank) : null;
  }
}

let activeProvider: FdRateProvider | null = null;

/** Returns the active FD rate provider (currently always the Prisma-backed one). */
export function getFdRateProvider(): FdRateProvider {
  if (!activeProvider) {
    activeProvider = new PrismaFdRateProvider();
  }
  return activeProvider;
}
