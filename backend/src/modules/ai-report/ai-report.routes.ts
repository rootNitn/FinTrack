import { Router } from "express";
import { aiReportController } from "./ai-report.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";
import { validate } from "../../middleware/validate";
import { aiReportImproveRequestSchema } from "./ai-report.dto";
import { aiImproveRateLimiter } from "../../middleware/rate-limit";

export const aiReportRoutes = Router();

aiReportRoutes.use(requireAuth);
aiReportRoutes.use(requirePlan("PRO"));
aiReportRoutes.post(
  "/improve",
  aiImproveRateLimiter,
  validate({ body: aiReportImproveRequestSchema }),
  aiReportController.improve
);
