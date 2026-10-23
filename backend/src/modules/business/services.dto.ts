import { z } from "zod";
import { BusinessContractStatus, BusinessProjectStatus } from "@prisma/client";

export const projectStatusEnum = z.nativeEnum(BusinessProjectStatus);
export const contractStatusEnum = z.nativeEnum(BusinessContractStatus);

export const createServiceClientSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const createServiceProjectSchema = z.object({
  businessId: z.string().uuid(),
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(40),
  status: projectStatusEnum.default(BusinessProjectStatus.PLANNED),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  budget: z.coerce.number().min(0).default(0),
  hourlyRate: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const createServiceContractSchema = z.object({
  projectId: z.string().uuid(),
  contractNumber: z.string().trim().min(1).max(50),
  status: contractStatusEnum.default(BusinessContractStatus.ACTIVE),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  fixedAmount: z.coerce.number().min(0).default(0),
  hourlyRate: z.coerce.number().min(0).default(0),
  description: z.string().trim().max(500).optional().nullable(),
});

export const createTimesheetSchema = z.object({
  projectId: z.string().uuid(),
  workDate: z.coerce.date(),
  hours: z.coerce.number().positive(),
  hourlyRate: z.coerce.number().min(0),
  description: z.string().trim().max(500).optional().nullable(),
  billable: z.boolean().default(true),
});

export const createServiceExpenseSchema = z.object({
  projectId: z.string().uuid(),
  expenseDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1).max(500),
  billable: z.boolean().default(true),
});

export type CreateServiceClientInput = z.infer<typeof createServiceClientSchema>;
export type CreateServiceProjectInput = z.infer<typeof createServiceProjectSchema>;
export type CreateServiceContractInput = z.infer<typeof createServiceContractSchema>;
export type CreateTimesheetInput = z.infer<typeof createTimesheetSchema>;
export type CreateServiceExpenseInput = z.infer<typeof createServiceExpenseSchema>;
