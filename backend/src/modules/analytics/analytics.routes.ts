import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const analyticsRoutes = Router();

analyticsRoutes.use(requireAuth);
analyticsRoutes.use(requirePlan("PLUS"));

analyticsRoutes.get("/export/excel", analyticsController.exportExcel);
analyticsRoutes.get("/export/pdf", analyticsController.exportPdf);
analyticsRoutes.get("/", analyticsController.getAnalytics);
