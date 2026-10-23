export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type PaidPlanTier = 'PLUS' | 'PRO';
export type SubscriptionStatus = 'CREATED' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

export interface CurrentPlan {
  planTier: 'FREE' | 'PLUS' | 'PRO';
  planExpiresAt: string | null;
}

export interface Subscription {
  id: string;
  planTier: PaidPlanTier;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  amount: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface CreateOrderPayload {
  planTier: PaidPlanTier;
  billingCycle: BillingCycle;
}

export interface CreateOrderResponse {
  subscriptionId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  planTier: PaidPlanTier;
  billingCycle: BillingCycle;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
