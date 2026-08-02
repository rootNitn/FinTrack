import { Router } from "express";
import { aiInsightsController } from "./ai-insights.controller";
import { requireAuth } from "../../middleware/auth";

export const aiInsightsRoutes = Router();

aiInsightsRoutes.use(requireAuth);

aiInsightsRoutes.get("/", aiInsightsController.getInsights);
