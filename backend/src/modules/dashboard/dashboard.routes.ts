import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { requireAuth } from "../../middleware/auth";

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth);
dashboardRoutes.get("/summary", dashboardController.summary);
dashboardRoutes.get("/kpis", dashboardController.kpis);
