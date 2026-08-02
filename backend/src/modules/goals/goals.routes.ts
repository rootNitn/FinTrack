import { Router } from "express";
import { goalsController } from "./goals.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { addGoalContributionSchema, createGoalSchema, updateGoalSchema } from "./goals.dto";

export const goalRoutes = Router();

goalRoutes.use(requireAuth);
goalRoutes.get("/upcoming", goalsController.upcoming);
goalRoutes.get("/", goalsController.list);
goalRoutes.post("/", validate({ body: createGoalSchema }), goalsController.create);
goalRoutes.get("/:id", goalsController.getById);
goalRoutes.patch("/:id", validate({ body: updateGoalSchema }), goalsController.update);
goalRoutes.post("/:id/contribute", validate({ body: addGoalContributionSchema }), goalsController.addContribution);
goalRoutes.delete("/:id", goalsController.remove);
