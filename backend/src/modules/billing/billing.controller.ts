import crypto from "crypto";
import { Response } from "express";
import { billingService } from "./billing.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { PLAN_PRICING } from "./billing.constants";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const billingController = {
  getPlans: asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, { pricing: PLAN_PRICING });
  }),

  getCurrentPlan: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await billingService.getCurrentPlan(requireUserId(req)));
  }),

  listSubscriptions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await billingService.listSubscriptions(requireUserId(req)));
  }),

  createOrder: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await billingService.createOrder(requireUserId(req), req.body));
  }),

  verifyPayment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await billingService.verifyPayment(requireUserId(req), req.body));
  }),

  /** Public endpoint (no user session) — Razorpay calls this directly, authenticated only via
   * the `x-razorpay-signature` header (HMAC of the raw body with RAZORPAY_WEBHOOK_SECRET). */
  webhook: asyncHandler(async (req: AuthenticatedRequest & { rawBody?: Buffer }, res: Response) => {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    if (!env.RAZORPAY_WEBHOOK_SECRET || !signature || !req.rawBody) {
      throw AppError.badRequest("Webhook not configured or missing signature");
    }

    const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(req.rawBody).digest("hex");
    if (expected !== signature) throw AppError.unauthorized("Invalid webhook signature");

    try {
      await billingService.handleWebhookEvent(req.body);
    } catch (err) {
      // Never fail the webhook response for a reconciliation error — log and ack so Razorpay
      // doesn't retry indefinitely; the client-side verify-payment call is the primary path.
      logger.error({ err }, "Failed to process Razorpay webhook event");
    }
    res.status(200).json({ success: true });
  }),
};
