import { z } from "zod";

export const createMilestoneSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  dueDate: z.coerce.date().optional().nullable(),
  amount: z.coerce.number().min(0).default(0),
});

export const createServiceInvoiceSchema = z.object({
  projectId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(50),
  issueDate: z.coerce.date().default(() => new Date()),
  dueDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1).max(500),
});

export const createTimesheetInputSchema = z.object({
  projectId: z.string().uuid(),
  workDate: z.coerce.date(),
  hours: z.coerce.number().positive(),
  hourlyRate: z.coerce.number().min(0),
  description: z.string().trim().max(500).optional().nullable(),
  billable: z.boolean().default(true),
});

export const createProjectExpenseInputSchema = z.object({
  projectId: z.string().uuid(),
  expenseDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1).max(500),
  billable: z.boolean().default(true),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type CreateServiceInvoiceInput = z.infer<typeof createServiceInvoiceSchema>;
