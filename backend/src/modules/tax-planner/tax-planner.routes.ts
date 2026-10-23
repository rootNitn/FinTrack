import { Router } from "express";
import { taxPlannerController } from "./tax-planner.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const taxPlannerRoutes = Router();

taxPlannerRoutes.use(requireAuth);
taxPlannerRoutes.use(requirePlan("PRO"));

taxPlannerRoutes.post("/", taxPlannerController.generate);
taxPlannerRoutes.get("/", taxPlannerController.list);
taxPlannerRoutes.get("/latest", taxPlannerController.latest);
