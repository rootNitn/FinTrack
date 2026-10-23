import { Router } from "express";
import { medicationsController } from "./medications.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createMedicationSchema, logMedicationSchema, updateMedicationSchema } from "./medications.dto";

export const medicationsRoutes = Router();

medicationsRoutes.use(requireAuth);
medicationsRoutes.get("/", medicationsController.list);
medicationsRoutes.post("/", validate({ body: createMedicationSchema }), medicationsController.create);
medicationsRoutes.get("/:id", medicationsController.getById);
medicationsRoutes.patch("/:id", validate({ body: updateMedicationSchema }), medicationsController.update);
medicationsRoutes.delete("/:id", medicationsController.remove);
medicationsRoutes.post("/:id/log", validate({ body: logMedicationSchema }), medicationsController.logDose);
medicationsRoutes.get("/:id/logs", medicationsController.getLogs);
