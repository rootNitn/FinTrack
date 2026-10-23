import { Router } from "express";
import { healthSummaryController } from "./health-summary.controller";
import { requireAuth } from "../../middleware/auth";

export const healthSummaryRoutes = Router();

healthSummaryRoutes.use(requireAuth);
healthSummaryRoutes.get("/", healthSummaryController.get);
