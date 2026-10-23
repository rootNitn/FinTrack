import { Router } from "express";
import { advanceTaxController } from "./advance-tax.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const advanceTaxRoutes = Router();

advanceTaxRoutes.use(requireAuth);
advanceTaxRoutes.use(requirePlan("PRO"));

advanceTaxRoutes.post("/calculate", advanceTaxController.calculate);
advanceTaxRoutes.get("/", advanceTaxController.list);
