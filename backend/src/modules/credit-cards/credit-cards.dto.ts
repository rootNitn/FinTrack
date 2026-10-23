import { z } from "zod";
import { CardNetwork } from "@prisma/client";

export const cardNetworkEnum = z.nativeEnum(CardNetwork);

const creditCardFields = {
  cardName: z.string().min(1, "Card name is required").max(120),
  bankName: z.string().min(1, "Bank name is required").max(120),
  network: cardNetworkEnum.default("OTHER"),
  cardNumber: z.string().regex(/^\d{12,19}$/, "Card number must be 12-19 digits"),
  creditLimit: z.coerce.number().positive("Credit limit must be greater than 0"),
  currentOutstanding: z.coerce.number().nonnegative().default(0),
  statementDay: z.coerce.number().int().min(1).max(31),
  paymentDueDays: z.coerce.number().int().min(1).max(60).default(20),
  annualFee: z.coerce.number().nonnegative().default(0),
  interestRatePercent: z.coerce.number().nonnegative().max(20).default(3.5),
  // Points per ₹100 spent / % cashback on spend — null means no auto accrual on statement creation.
  rewardRatePercent: z.coerce.number().nonnegative().max(20).nullable().optional(),
  cashbackRatePercent: z.coerce.number().nonnegative().max(20).nullable().optional(),
  notes: z.string().max(500).optional(),
  familyMemberId: z.string().uuid().nullable().optional(),
};

export const createCreditCardSchema = z.object(creditCardFields).superRefine((value, ctx) => {
  if (value.currentOutstanding > value.creditLimit) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["currentOutstanding"], message: "Outstanding cannot exceed credit limit" });
  }
});

export const updateCreditCardSchema = z.object(creditCardFields).partial();

const statementFields = {
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  statementDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  totalDue: z.coerce.number().nonnegative(),
  minimumDue: z.coerce.number().nonnegative(),
  // Omit to auto-accrue from the card's rewardRatePercent/cashbackRatePercent × totalDue; provide
  // an explicit value to override (e.g. a bonus-category month that earns more than the base rate).
  rewardPointsEarned: z.coerce.number().nonnegative().optional(),
  cashbackEarned: z.coerce.number().nonnegative().optional(),
};

export const createStatementSchema = z.object(statementFields).superRefine((value, ctx) => {
  if (value.minimumDue > value.totalDue) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["minimumDue"], message: "Minimum due cannot exceed total due" });
  }
});

export const updateStatementSchema = z.object(statementFields).partial();

export const createPaymentSchema = z.object({
  amount: z.coerce.number().positive("Payment amount must be greater than 0"),
  paidDate: z.coerce.date().default(() => new Date()),
  statementId: z.string().uuid().optional(),
  method: z.string().max(50).optional(),
  notes: z.string().max(300).optional(),
});

export const redeemRewardSchema = z.object({
  type: z.enum(["POINTS", "CASHBACK"]),
  amount: z.coerce.number().positive("Redemption amount must be greater than 0"),
});

export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
export type CreateStatementInput = z.infer<typeof createStatementSchema>;
export type UpdateStatementInput = z.infer<typeof updateStatementSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type RedeemRewardInput = z.infer<typeof redeemRewardSchema>;
