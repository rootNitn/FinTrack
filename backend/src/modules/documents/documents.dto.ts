import { z } from "zod";

export const taxDocumentTypeSchema = z.enum([
  "SALARY_SLIP",
  "FORM16",
  "AIS",
  "FORM26AS",
  "CAPITAL_GAINS_STATEMENT",
  "OTHER",
]);

export const uploadDocumentSchema = z.object({
  documentType: taxDocumentTypeSchema,
  financialYearCode: z.string().min(1),
});

export const listDocumentsQuerySchema = z.object({
  documentType: taxDocumentTypeSchema.optional(),
  financialYearCode: z.string().min(1).optional(),
});

// Shared across all per-type import modules (salary-slip, form16, ais, form26as) for the
// "unlock a password-protected PDF" endpoint. The password is validated here but never persisted
// anywhere — it is used only for a single in-memory decryption attempt.
export const unlockDocumentSchema = z.object({
  password: z.string().min(1, "Password is required"),
});
