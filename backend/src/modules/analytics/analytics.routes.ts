import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { requireAuth } from "../../middleware/auth";

export const analyticsRoutes = Router();

analyticsRoutes.use(requireAuth);

analyticsRoutes.get("/", analyticsController.getAnalytics);
