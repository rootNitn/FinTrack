import { Router } from "express";
import { budgetsController } from "./budgets.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { upsertBudgetSchema } from "./budgets.dto";

export const budgetRoutes = Router();

budgetRoutes.use(requireAuth);
budgetRoutes.get("/", budgetsController.summary);
budgetRoutes.post("/", validate({ body: upsertBudgetSchema }), budgetsController.upsert);
budgetRoutes.delete("/:id", budgetsController.remove);
