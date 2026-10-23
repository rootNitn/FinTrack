import { z } from "zod";

export const createOrderSchema = z.object({
  planTier: z.enum(["PLUS", "PRO"]),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
