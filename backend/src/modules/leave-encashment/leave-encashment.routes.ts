import { Router } from "express";
import { leaveEncashmentController } from "./leave-encashment.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const leaveEncashmentRoutes = Router();

leaveEncashmentRoutes.use(requireAuth);
leaveEncashmentRoutes.use(requirePlan("PRO"));

leaveEncashmentRoutes.post("/calculate", leaveEncashmentController.calculate);
