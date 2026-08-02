import { z } from "zod";

export const calculateHraSchema = z.object({
  basicSalary: z.coerce.number().min(0),
  hraReceived: z.coerce.number().min(0),
  rentPaid: z.coerce.number().min(0),
  state: z.string().min(1),
});

export type CalculateHraInput = z.infer<typeof calculateHraSchema>;
