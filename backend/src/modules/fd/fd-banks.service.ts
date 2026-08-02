import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateFdBankInput, UpdateFdBankInput } from "./fd-banks.dto";
import { getFdRateProvider } from "./providers/fd-rate.provider";

function serializeBank<T extends Record<string, unknown>>(bank: T) {
  return {
    ...bank,
    minDeposit: Number(bank.minDeposit as Prisma.Decimal),
    maxDeposit: bank.maxDeposit !== null && bank.maxDeposit !== undefined ? Number(bank.maxDeposit as Prisma.Decimal) : null,
    depositInsuranceCover: Number(bank.depositInsuranceCover as Prisma.Decimal),
  };
}

interface ImportRow {
  bankName: string;
  bankType: string;
  rating?: number;
  minDeposit?: number;
  maxDeposit?: number;
  websiteUrl?: string;
  tenureLabel: string;
  tenureMinDays: number;
  tenureMaxDays: number;
  interestRate: number;
  seniorCitizenRate: number;
  compounding?: string;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

export const fdBanksService = {
  async list(filters: { search?: string; bankType?: string; activeOnly?: boolean }) {
    const where: Prisma.FdBankWhereInput = {
      ...(filters.activeOnly ? { isActive: true } : {}),
      ...(filters.bankType ? { bankType: filters.bankType as never } : {}),
      ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" } } : {}),
    };
    const banks = await prisma.fdBank.findMany({
      where,
      include: { rates: { orderBy: { tenureMinDays: "asc" } } },
      orderBy: { name: "asc" },
    });
    return banks.map(serializeBank);
  },

  async getById(id: string) {
    const bank = await prisma.fdBank.findUnique({ where: { id }, include: { rates: { orderBy: { tenureMinDays: "asc" } } } });
    if (!bank) throw AppError.notFound("Bank not found");
    return serializeBank(bank);
  },

  async create(input: CreateFdBankInput) {
    const existing = await prisma.fdBank.findUnique({ where: { name: input.name } });
    if (existing) throw AppError.conflict("A bank with this name already exists");
    const bank = await prisma.fdBank.create({ data: input });
    return serializeBank(bank);
  },

  async update(id: string, input: UpdateFdBankInput) {
    const existing = await prisma.fdBank.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Bank not found");
    const bank = await prisma.fdBank.update({ where: { id }, data: input });
    return serializeBank(bank);
  },

  async remove(id: string) {
    const existing = await prisma.fdBank.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Bank not found");
    await prisma.fdBank.delete({ where: { id } });
  },

  /** Parses an uploaded CSV or XLSX file of bank + rate rows and upserts banks/rates/history. */
  async importFromFile(buffer: Buffer, originalName: string) {
    const isCsv = originalName.toLowerCase().endsWith(".csv");
    const rows: ImportRow[] = [];
    const errors: { row: number; message: string }[] = [];

    if (isCsv) {
      const parsed = parseCsv(buffer.toString("utf8"));
      parsed.forEach((r, idx) => {
        try {
          rows.push({
            bankName: r.bankName,
            bankType: r.bankType,
            rating: r.rating ? Number(r.rating) : undefined,
            minDeposit: r.minDeposit ? Number(r.minDeposit) : undefined,
            maxDeposit: r.maxDeposit ? Number(r.maxDeposit) : undefined,
            websiteUrl: r.websiteUrl || undefined,
            tenureLabel: r.tenureLabel,
            tenureMinDays: Number(r.tenureMinDays),
            tenureMaxDays: Number(r.tenureMaxDays),
            interestRate: Number(r.interestRate),
            seniorCitizenRate: Number(r.seniorCitizenRate),
            compounding: r.compounding || undefined,
          });
        } catch {
          errors.push({ row: idx + 2, message: "Could not parse row" });
        }
      });
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as never);
      const sheet = workbook.worksheets[0];
      const headerRow = sheet.getRow(1).values as unknown[];
      const headers = headerRow.map((h) => String(h ?? "").trim());

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = row.values as unknown[];
        const get = (key: string) => {
          const idx = headers.indexOf(key);
          return idx > 0 ? values[idx] : undefined;
        };
        try {
          rows.push({
            bankName: String(get("bankName") ?? "").trim(),
            bankType: String(get("bankType") ?? "").trim(),
            rating: get("rating") ? Number(get("rating")) : undefined,
            minDeposit: get("minDeposit") ? Number(get("minDeposit")) : undefined,
            maxDeposit: get("maxDeposit") ? Number(get("maxDeposit")) : undefined,
            websiteUrl: get("websiteUrl") ? String(get("websiteUrl")) : undefined,
            tenureLabel: String(get("tenureLabel") ?? "").trim(),
            tenureMinDays: Number(get("tenureMinDays")),
            tenureMaxDays: Number(get("tenureMaxDays")),
            interestRate: Number(get("interestRate")),
            seniorCitizenRate: Number(get("seniorCitizenRate")),
            compounding: get("compounding") ? String(get("compounding")) : undefined,
          });
        } catch {
          errors.push({ row: rowNumber, message: "Could not parse row" });
        }
      });
    }

    let bankCount = 0;
    let rateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.bankName || !row.tenureLabel || Number.isNaN(row.interestRate)) {
        errors.push({ row: i + 2, message: "Missing required fields (bankName, tenureLabel, interestRate)" });
        continue;
      }

      try {
        const bank = await prisma.fdBank.upsert({
          where: { name: row.bankName },
          update: {
            ...(row.bankType ? { bankType: row.bankType as never } : {}),
            ...(row.rating !== undefined ? { rating: row.rating } : {}),
            ...(row.minDeposit !== undefined ? { minDeposit: row.minDeposit } : {}),
            ...(row.maxDeposit !== undefined ? { maxDeposit: row.maxDeposit } : {}),
            ...(row.websiteUrl ? { websiteUrl: row.websiteUrl } : {}),
          },
          create: {
            name: row.bankName,
            bankType: (row.bankType || "PRIVATE") as never,
            rating: row.rating ?? 4,
            minDeposit: row.minDeposit ?? 1000,
            maxDeposit: row.maxDeposit,
            websiteUrl: row.websiteUrl,
          },
        });
        bankCount++;

        const existingRate = await prisma.fdRate.findFirst({ where: { bankId: bank.id, tenureLabel: row.tenureLabel } });
        if (existingRate) {
          await prisma.fdRate.update({
            where: { id: existingRate.id },
            data: {
              tenureMinDays: row.tenureMinDays,
              tenureMaxDays: row.tenureMaxDays,
              interestRate: row.interestRate,
              seniorCitizenRate: row.seniorCitizenRate || row.interestRate + 0.5,
              ...(row.compounding ? { compounding: row.compounding as never } : {}),
            },
          });
        } else {
          await prisma.fdRate.create({
            data: {
              bankId: bank.id,
              tenureLabel: row.tenureLabel,
              tenureMinDays: row.tenureMinDays,
              tenureMaxDays: row.tenureMaxDays,
              interestRate: row.interestRate,
              seniorCitizenRate: row.seniorCitizenRate || row.interestRate + 0.5,
              compounding: (row.compounding || "QUARTERLY") as never,
            },
          });
        }
        rateCount++;

        await prisma.fdRateHistory.create({
          data: { bankId: bank.id, tenureLabel: row.tenureLabel, interestRate: row.interestRate },
        });
      } catch (err) {
        errors.push({ row: i + 2, message: err instanceof Error ? err.message : "Failed to import row" });
      }
    }

    return { bankCount, rateCount, errorCount: errors.length, errors };
  },

  async listActiveViaProvider() {
    return getFdRateProvider().getAllBanks(true);
  },
};
