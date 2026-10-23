import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { incomeSourcesController } from "./income-sources.controller";
import { createIncomeSourceSchema, updateIncomeSourceSchema } from "./income-sources.dto";

export const incomeSourcesRoutes = Router();
incomeSourcesRoutes.use(requireAuth);
incomeSourcesRoutes.get("/", incomeSourcesController.list);
incomeSourcesRoutes.post("/", validate({ body: createIncomeSourceSchema }), incomeSourcesController.create);
incomeSourcesRoutes.patch("/:id", validate({ body: updateIncomeSourceSchema }), incomeSourcesController.update);
incomeSourcesRoutes.delete("/:id", incomeSourcesController.remove);
