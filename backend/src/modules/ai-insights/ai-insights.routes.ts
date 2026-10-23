import { Router } from "express";
import { aiInsightsController } from "./ai-insights.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const aiInsightsRoutes = Router();

aiInsightsRoutes.use(requireAuth);
aiInsightsRoutes.use(requirePlan("PRO"));

aiInsightsRoutes.get("/", aiInsightsController.getInsights);
