import { Router } from "express";
import { leaveEncashmentController } from "./leave-encashment.controller";
import { requireAuth } from "../../middleware/auth";

export const leaveEncashmentRoutes = Router();

leaveEncashmentRoutes.use(requireAuth);

leaveEncashmentRoutes.post("/calculate", leaveEncashmentController.calculate);
