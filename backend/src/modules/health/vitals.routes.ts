import { Router } from "express";
import { vitalsController } from "./vitals.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createVitalSchema, updateVitalSchema } from "./vitals.dto";

export const vitalsRoutes = Router();

vitalsRoutes.use(requireAuth);
vitalsRoutes.get("/", vitalsController.list);
vitalsRoutes.post("/", validate({ body: createVitalSchema }), vitalsController.create);
vitalsRoutes.patch("/:id", validate({ body: updateVitalSchema }), vitalsController.update);
vitalsRoutes.delete("/:id", vitalsController.remove);
