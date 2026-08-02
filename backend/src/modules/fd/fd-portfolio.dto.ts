import { z } from "zod";
import { FdCompoundingFrequency, FdDepositType, FdPortfolioStatus } from "@prisma/client";

export const createFdPortfolioSchema = z
  .object({
    bankId: z.string().uuid().optional(),
    bankName: z.string().min(1).max(150),
    amount: z.coerce.number().positive(),
    interestRate: z.coerce.number().positive().max(20),
    depositType: z.nativeEnum(FdDepositType).default("CUMULATIVE"),
    compounding: z.nativeEnum(FdCompoundingFrequency).default("QUARTERLY"),
    openingDate: z.coerce.date(),
    maturityDate: z.coerce.date(),
    nominee: z.string().max(150).optional(),
    notes: z.string().max(1000).optional(),
    status: z.nativeEnum(FdPortfolioStatus).default("ACTIVE"),
  })
  .superRefine((data, ctx) => {
    if (data.maturityDate <= data.openingDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maturity date must be after the opening date",
        path: ["maturityDate"],
      });
    }
  });

export const updateFdPortfolioSchema = z.object({
  bankId: z.string().uuid().optional(),
  bankName: z.string().min(1).max(150).optional(),
  amount: z.coerce.number().positive().optional(),
  interestRate: z.coerce.number().positive().max(20).optional(),
  depositType: z.nativeEnum(FdDepositType).optional(),
  compounding: z.nativeEnum(FdCompoundingFrequency).optional(),
  openingDate: z.coerce.date().optional(),
  maturityDate: z.coerce.date().optional(),
  nominee: z.string().max(150).optional(),
  notes: z.string().max(1000).optional(),
  status: z.nativeEnum(FdPortfolioStatus).optional(),
});

export type CreateFdPortfolioInput = z.infer<typeof createFdPortfolioSchema>;
export type UpdateFdPortfolioInput = z.infer<typeof updateFdPortfolioSchema>;
