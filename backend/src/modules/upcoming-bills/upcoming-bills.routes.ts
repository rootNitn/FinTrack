import { Router } from "express";
import { upcomingBillsController } from "./upcoming-bills.controller";
import { requireAuth } from "../../middleware/auth";

export const upcomingBillsRoutes = Router();

upcomingBillsRoutes.use(requireAuth);

upcomingBillsRoutes.get("/", upcomingBillsController.list);
