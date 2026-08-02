import { Router } from "express";
import { reconciliationController } from "./reconciliation.controller";
import { requireAuth } from "../../middleware/auth";

export const reconciliationRoutes = Router();

reconciliationRoutes.use(requireAuth);

reconciliationRoutes.get("/", reconciliationController.report);
