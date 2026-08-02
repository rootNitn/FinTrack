import { z } from "zod";

export const createFamilyMemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  relation: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #4f46e5")
    .optional(),
});

export const updateFamilyMemberSchema = createFamilyMemberSchema.partial();

export type CreateFamilyMemberInput = z.infer<typeof createFamilyMemberSchema>;
export type UpdateFamilyMemberInput = z.infer<typeof updateFamilyMemberSchema>;
