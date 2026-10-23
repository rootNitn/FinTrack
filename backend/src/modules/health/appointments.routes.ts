import { Router } from "express";
import { appointmentsController } from "./appointments.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createAppointmentSchema, updateAppointmentSchema } from "./appointments.dto";

export const appointmentsRoutes = Router();

appointmentsRoutes.use(requireAuth);
appointmentsRoutes.get("/", appointmentsController.list);
appointmentsRoutes.post("/", validate({ body: createAppointmentSchema }), appointmentsController.create);
appointmentsRoutes.get("/:id", appointmentsController.getById);
appointmentsRoutes.patch("/:id", validate({ body: updateAppointmentSchema }), appointmentsController.update);
appointmentsRoutes.delete("/:id", appointmentsController.remove);
