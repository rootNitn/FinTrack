import { Router } from "express";
import { workoutsController } from "./workouts.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createWorkoutSchema, updateWorkoutSchema } from "./workouts.dto";

export const workoutsRoutes = Router();

workoutsRoutes.use(requireAuth);
workoutsRoutes.get("/", workoutsController.list);
workoutsRoutes.post("/", validate({ body: createWorkoutSchema }), workoutsController.create);
workoutsRoutes.patch("/:id", validate({ body: updateWorkoutSchema }), workoutsController.update);
workoutsRoutes.delete("/:id", workoutsController.remove);
