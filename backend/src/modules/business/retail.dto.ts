import { z } from "zod";
import { BusinessMemberRole } from "@prisma/client";

export const memberRoleEnum = z.nativeEnum(BusinessMemberRole);

export const retailProductQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  lowStockOnly: z.coerce.boolean().optional(),
});

export const createMemberSchema = z.object({
  businessId: z.string().uuid(),
  userId: z.string().uuid(),
  role: memberRoleEnum.default(BusinessMemberRole.CASHIER),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
