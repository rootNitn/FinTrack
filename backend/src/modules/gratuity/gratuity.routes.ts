import { Router } from "express";
import { gratuityController } from "./gratuity.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const gratuityRoutes = Router();

gratuityRoutes.use(requireAuth);
gratuityRoutes.use(requirePlan("PRO"));

gratuityRoutes.post("/calculate", gratuityController.calculate);
