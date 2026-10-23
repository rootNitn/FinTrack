import { Router } from "express";
import { hraController } from "./hra.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const hraRoutes = Router();

hraRoutes.use(requireAuth);
hraRoutes.use(requirePlan("PRO"));

hraRoutes.post("/calculate", hraController.calculate);
