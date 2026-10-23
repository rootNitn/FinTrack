import { Router } from "express";
import { financialHealthController } from "./financial-health.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const financialHealthRoutes = Router();

financialHealthRoutes.use(requireAuth);
financialHealthRoutes.use(requirePlan("PLUS"));

financialHealthRoutes.get("/summary", financialHealthController.getSummary);
