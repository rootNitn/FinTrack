import { Router } from "express";
import { incomeController } from "./income.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createIncomeSchema, updateIncomeSchema } from "./income.dto";

export const incomeRoutes = Router();

incomeRoutes.use(requireAuth);
incomeRoutes.get("/", incomeController.list);
incomeRoutes.post("/", validate({ body: createIncomeSchema }), incomeController.create);
incomeRoutes.get("/:id", incomeController.getById);
incomeRoutes.patch("/:id", validate({ body: updateIncomeSchema }), incomeController.update);
incomeRoutes.delete("/:id", incomeController.remove);
