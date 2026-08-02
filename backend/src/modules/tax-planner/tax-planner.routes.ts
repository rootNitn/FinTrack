import { Router } from "express";
import { taxPlannerController } from "./tax-planner.controller";
import { requireAuth } from "../../middleware/auth";

export const taxPlannerRoutes = Router();

taxPlannerRoutes.use(requireAuth);

taxPlannerRoutes.post("/", taxPlannerController.generate);
taxPlannerRoutes.get("/", taxPlannerController.list);
taxPlannerRoutes.get("/latest", taxPlannerController.latest);
