import { Router } from "express";
import { investmentComparisonController } from "./investment-comparison.controller";
import { requireAuth } from "../../middleware/auth";

export const investmentComparisonRoutes = Router();

investmentComparisonRoutes.use(requireAuth);

investmentComparisonRoutes.get("/", investmentComparisonController.compare);
