import { z } from "zod";
import { AccountType } from "@prisma/client";

export const accountTypeEnum = z.nativeEnum(AccountType);

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1, "Bank name is required").max(120),
  accountType: accountTypeEnum,
  balance: z.coerce.number().nonnegative("Balance cannot be negative"),
  ifsc: z
    .string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format")
    .transform((v) => v.toUpperCase()),
  accountNumber: z
    .string()
    .regex(/^\d{6,20}$/, "Account number must be 6-20 digits"),
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
