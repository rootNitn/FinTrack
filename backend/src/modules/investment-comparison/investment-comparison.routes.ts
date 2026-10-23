import { Router } from "express";
import { investmentComparisonController } from "./investment-comparison.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const investmentComparisonRoutes = Router();

investmentComparisonRoutes.use(requireAuth);
investmentComparisonRoutes.use(requirePlan("PLUS"));

investmentComparisonRoutes.get("/", investmentComparisonController.compare);
