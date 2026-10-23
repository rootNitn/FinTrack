import { Router } from "express";
import { reconciliationController } from "./reconciliation.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const reconciliationRoutes = Router();

reconciliationRoutes.use(requireAuth);
reconciliationRoutes.use(requirePlan("PRO"));

reconciliationRoutes.get("/", reconciliationController.report);
