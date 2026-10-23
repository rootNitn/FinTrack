import { Router } from "express";
import { healthGoalsController } from "./health-goals.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createHealthGoalSchema, updateHealthGoalSchema } from "./health-goals.dto";

export const healthGoalsRoutes = Router();

healthGoalsRoutes.use(requireAuth);
healthGoalsRoutes.get("/", healthGoalsController.list);
healthGoalsRoutes.post("/", validate({ body: createHealthGoalSchema }), healthGoalsController.create);
healthGoalsRoutes.get("/:id", healthGoalsController.getById);
healthGoalsRoutes.patch("/:id", validate({ body: updateHealthGoalSchema }), healthGoalsController.update);
healthGoalsRoutes.delete("/:id", healthGoalsController.remove);
