import { Router } from "express";
import { insuranceController } from "./insurance.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createInsurancePolicySchema, updateInsurancePolicySchema } from "./insurance.dto";

export const insuranceRoutes = Router();

insuranceRoutes.use(requireAuth);
insuranceRoutes.get("/", insuranceController.list);
insuranceRoutes.post("/", validate({ body: createInsurancePolicySchema }), insuranceController.create);
insuranceRoutes.patch("/:id", validate({ body: updateInsurancePolicySchema }), insuranceController.update);
insuranceRoutes.delete("/:id", insuranceController.remove);
