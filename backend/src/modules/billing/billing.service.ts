import crypto from "crypto";
import { Prisma, PlanTier } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logger } from "../../config/logger";
import { env } from "../../config/env";
import { getRazorpayClient, isRazorpayConfigured } from "./razorpay.client";
import { priceFor } from "./billing.constants";
import { CreateOrderInput, VerifyPaymentInput } from "./billing.dto";

function addBillingCycle(from: Date, billingCycle: "MONTHLY" | "YEARLY"): Date {
  const end = new Date(from);
  if (billingCycle === "MONTHLY") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}

function serializeSubscription<T extends Record<string, unknown>>(sub: T) {
  return { ...sub, amount: Number(sub.amount as Prisma.Decimal) };
}

export const billingService = {
  /** Current effective plan — downgrades an expired paid plan back to FREE on read. */
  async getCurrentPlan(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { planTier: true, planExpiresAt: true },
    });

    if (user.planTier !== "FREE" && user.planExpiresAt && user.planExpiresAt < new Date()) {
      const downgraded = await prisma.user.update({
        where: { id: userId },
        data: { planTier: "FREE", planExpiresAt: null },
        select: { planTier: true, planExpiresAt: true },
      });
      return downgraded;
    }

    return user;
  },

  async listSubscriptions(userId: string) {
    const subs = await prisma.subscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return subs.map(serializeSubscription);
  },

  async createOrder(userId: string, input: CreateOrderInput) {
    if (!isRazorpayConfigured) {
      throw AppError.badRequest("Payments are not configured yet. Please try again later.");
    }

    const amountRupees = priceFor(input.planTier, input.billingCycle);
    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount: amountRupees * 100, // paise
      currency: "INR",
      receipt: `plan_${input.planTier.toLowerCase()}_${Date.now()}`,
      notes: { userId, planTier: input.planTier, billingCycle: input.billingCycle },
    });

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planTier: input.planTier,
        billingCycle: input.billingCycle,
        status: "CREATED",
        amount: amountRupees,
        currency: "INR",
        razorpayOrderId: order.id,
      },
    });

    return {
      subscriptionId: subscription.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
      planTier: input.planTier,
      billingCycle: input.billingCycle,
    };
  },

  async verifyPayment(userId: string, input: VerifyPaymentInput) {
    if (!isRazorpayConfigured) {
      throw AppError.badRequest("Payments are not configured yet. Please try again later.");
    }

    const subscription = await prisma.subscription.findFirst({
      where: { razorpayOrderId: input.razorpay_order_id, userId },
    });
    if (!subscription) throw AppError.notFound("Order not found");
    if (subscription.status === "ACTIVE") return billingService.getCurrentPlan(userId);

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET!)
      .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== input.razorpay_signature) {
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "FAILED" } });
      throw AppError.badRequest("Payment verification failed");
    }

    const startDate = new Date();
    const endDate = addBillingCycle(startDate, subscription.billingCycle);

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          razorpayPaymentId: input.razorpay_payment_id,
          razorpaySignature: input.razorpay_signature,
          startDate,
          endDate,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { planTier: subscription.planTier, planExpiresAt: endDate },
      }),
    ]);

    return billingService.getCurrentPlan(userId);
  },

  /** Reconciles a Razorpay webhook event (e.g. if the user closed the tab before the client-side
   * verify-payment call ran). Trusts the webhook signature instead of the per-request one. */
  async handleWebhookEvent(payload: { event: string; payload: Record<string, unknown> }) {
    if (payload.event !== "payment.captured" && payload.event !== "payment.failed") return;

    const paymentEntity = (payload.payload as { payment?: { entity?: Record<string, unknown> } })?.payment?.entity;
    const orderId = paymentEntity?.order_id as string | undefined;
    if (!orderId) return;

    const subscription = await prisma.subscription.findFirst({ where: { razorpayOrderId: orderId } });
    if (!subscription || subscription.status === "ACTIVE") return;

    if (payload.event === "payment.failed") {
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "FAILED" } });
      return;
    }

    const startDate = new Date();
    const endDate = addBillingCycle(startDate, subscription.billingCycle);
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          razorpayPaymentId: paymentEntity?.id as string | undefined,
          startDate,
          endDate,
        },
      }),
      prisma.user.update({
        where: { id: subscription.userId },
        data: { planTier: subscription.planTier as PlanTier, planExpiresAt: endDate },
      }),
    ]);
    logger.info({ subscriptionId: subscription.id }, "Activated subscription via Razorpay webhook");
  },
};
