import { z } from "zod";

export const addFdFavoriteSchema = z.object({
  bankId: z.string().uuid(),
});
