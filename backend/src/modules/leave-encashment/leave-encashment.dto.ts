import { z } from "zod";

export const calculateLeaveEncashmentSchema = z.object({
  employeeType: z.enum(["GOVERNMENT", "NON_GOVERNMENT"]),
  leaveEncashmentReceived: z.coerce.number().min(0),
  avgMonthlySalaryLast10Months: z.coerce.number().min(0),
  leaveDaysEncashed: z.coerce.number().min(0),
  yearsOfService: z.coerce.number().min(0),
  financialYearCode: z.string().min(1).optional(),
});

export type CalculateLeaveEncashmentInput = z.infer<typeof calculateLeaveEncashmentSchema>;
