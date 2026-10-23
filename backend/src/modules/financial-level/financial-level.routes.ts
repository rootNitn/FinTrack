import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";
import { financialLevelController } from "./financial-level.controller";

export const financialLevelRoutes = Router();
financialLevelRoutes.use(requireAuth);
financialLevelRoutes.use(requirePlan("PLUS"));
financialLevelRoutes.get("/summary", financialLevelController.summary);
