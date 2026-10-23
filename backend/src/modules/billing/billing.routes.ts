import { Router } from "express";
import { billingController } from "./billing.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createOrderSchema, verifyPaymentSchema } from "./billing.dto";

export const billingRoutes = Router();

// Razorpay calls this directly — must stay outside requireAuth, verified via signature instead.
billingRoutes.post("/webhook", billingController.webhook);

billingRoutes.use(requireAuth);

billingRoutes.get("/plans", billingController.getPlans);
billingRoutes.get("/me", billingController.getCurrentPlan);
billingRoutes.get("/subscriptions", billingController.listSubscriptions);
billingRoutes.post("/create-order", validate({ body: createOrderSchema }), billingController.createOrder);
billingRoutes.post("/verify-payment", validate({ body: verifyPaymentSchema }), billingController.verifyPayment);
