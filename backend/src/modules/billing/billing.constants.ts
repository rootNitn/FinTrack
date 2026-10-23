import { BillingCycle, PlanTier } from "@prisma/client";

type PaidPlan = "PLUS" | "PRO";

/** Prices in INR (whole rupees). Mirrors frontend/src/app/features/landing/landing.config.ts
 * PRICING_PLANS — keep both in sync when prices change. FREE has no order/checkout. */
export const PLAN_PRICING: Record<PaidPlan, Record<BillingCycle, number>> = {
  PLUS: { MONTHLY: 199, YEARLY: 1990 },
  PRO: { MONTHLY: 399, YEARLY: 3990 },
};

/** FREE < PLUS < PRO — used by requirePlan middleware to check a user's plan meets a route's minimum. */
export const PLAN_RANK: Record<PlanTier, number> = { FREE: 0, PLUS: 1, PRO: 2 };

export function planSatisfies(userPlan: PlanTier, minPlan: PlanTier): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[minPlan];
}

export function priceFor(planTier: PaidPlan, billingCycle: BillingCycle): number {
  return PLAN_PRICING[planTier][billingCycle];
}
