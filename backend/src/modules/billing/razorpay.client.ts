import Razorpay from "razorpay";
import { env } from "../../config/env";

export const isRazorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

let client: Razorpay | null = null;

/** Lazily constructed so the server can boot without keys — only throws when a billing endpoint is actually hit. */
export function getRazorpayClient(): Razorpay {
  if (!isRazorpayConfigured) {
    throw new Error("Razorpay is not configured (set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  }
  if (!client) {
    client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! });
  }
  return client;
}
