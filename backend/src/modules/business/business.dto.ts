import { z } from "zod";
import { BusinessEntryType } from "@prisma/client";

export const businessEntryTypeEnum = z.nativeEnum(BusinessEntryType);

export const createBusinessEntrySchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  type: businessEntryTypeEnum,
  category: z.string().trim().max(80).optional().nullable(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.coerce.date(),
  description: z.string().trim().max(500).optional().nullable(),
});

export type CreateBusinessEntryInput = z.infer<typeof createBusinessEntrySchema>;
