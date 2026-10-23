import { z } from "zod";
import { BusinessAccountType, BusinessType, JournalEntryStatus } from "@prisma/client";

export const businessTypeEnum = z.nativeEnum(BusinessType);
export const businessAccountTypeEnum = z.nativeEnum(BusinessAccountType);
export const journalEntryStatusEnum = z.nativeEnum(JournalEntryStatus);

export const createBusinessProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  legalName: z.string().trim().max(160).optional().nullable(),
  type: businessTypeEnum.default(BusinessType.MANUFACTURING),
  currency: z.string().trim().length(3).default("INR"),
  fiscalYearStart: z.coerce.number().int().min(1).max(12).default(4),
});

export const createBusinessAccountSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(1).max(120),
  type: businessAccountTypeEnum,
});

const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  description: z.string().trim().max(240).optional().nullable(),
}).refine((line) => (line.debit > 0) !== (line.credit > 0), {
  message: "Each journal line must have either a debit or a credit",
});

export const createJournalEntrySchema = z.object({
  businessId: z.string().uuid(),
  entryDate: z.coerce.date(),
  reference: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().min(1).max(240),
  lines: z.array(journalLineSchema).min(2).max(100),
});

export const rejectJournalEntrySchema = z.object({ reason: z.string().trim().min(1).max(240) });
export const reverseJournalEntrySchema = z.object({ entryDate: z.coerce.date().optional() });

export type CreateBusinessProfileInput = z.infer<typeof createBusinessProfileSchema>;
export type CreateBusinessAccountInput = z.infer<typeof createBusinessAccountSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
