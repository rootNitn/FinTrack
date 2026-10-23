import { z } from "zod";
import { TransactionType } from "@prisma/client";

export const transactionTypeEnum = z.nativeEnum(TransactionType);

export const transactionListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  type: transactionTypeEnum.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  bankAccountId: z.string().uuid().optional(),
  category: z.string().optional(),
  familyMemberId: z.string().uuid().optional(),
});
