import { Router } from "express";
import { capitalGainsController } from "./capital-gains.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

export const capitalGainsRoutes = Router();

capitalGainsRoutes.use(requireAuth);
capitalGainsRoutes.use(requirePlan("PRO"));

capitalGainsRoutes.post("/calculate", capitalGainsController.calculate);
capitalGainsRoutes.get("/", capitalGainsController.list);
capitalGainsRoutes.delete("/:id", capitalGainsController.remove);
