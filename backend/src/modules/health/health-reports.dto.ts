import { z } from "zod";

export const uploadHealthReportSchema = z.object({
  reportDate: z.coerce.date(),
  testDate: z.coerce.date().optional(),
  labName: z.string().max(150).optional(),
  password: z.string().max(200).optional(),
});

export const updateHealthReportSchema = z.object({
  reportDate: z.coerce.date().optional(),
  testDate: z.coerce.date().nullable().optional(),
  labName: z.string().max(150).optional(),
});

export const createHealthReportResultSchema = z.object({
  testName: z.string().min(1, "Test name is required").max(150),
  value: z.coerce.number(),
  unit: z.string().max(30).optional(),
  referenceLow: z.coerce.number().optional(),
  referenceHigh: z.coerce.number().optional(),
});

export const updateHealthReportResultSchema = createHealthReportResultSchema.partial();

export type UpdateHealthReportInput = z.infer<typeof updateHealthReportSchema>;
export type CreateHealthReportResultInput = z.infer<typeof createHealthReportResultSchema>;
export type UpdateHealthReportResultInput = z.infer<typeof updateHealthReportResultSchema>;
