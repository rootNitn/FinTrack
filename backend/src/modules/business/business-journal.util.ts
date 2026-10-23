import { BusinessAccountType, JournalEntryStatus, Prisma } from "@prisma/client";
import { AppError } from "../../utils/app-error";

export interface JournalLineInput {
  accountId: string;
  debit: number | Prisma.Decimal;
  credit: number | Prisma.Decimal;
  description?: string | null;
}

export function assertBalancedJournalLines(lines: JournalLineInput[]) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
  if (Number(debit.toFixed(2)) !== Number(credit.toFixed(2))) {
    throw AppError.badRequest("Journal entry is not balanced: debits must equal credits");
  }
}

export async function createBusinessJournalEntry(
  tx: Prisma.TransactionClient,
  input: { businessId: string; entryDate: Date; reference?: string | null; description: string; lines: JournalLineInput[]; status?: JournalEntryStatus; createdByUserId?: string },
) {
  assertBalancedJournalLines(input.lines);
  return tx.businessJournalEntry.create({ data: { ...input, lines: { create: input.lines } } });
}

export const debitNormalAccountTypes = new Set<BusinessAccountType>([
  BusinessAccountType.ASSET,
  BusinessAccountType.INVENTORY,
  BusinessAccountType.EXPENSE,
  BusinessAccountType.COGS,
]);
