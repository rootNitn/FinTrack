import { Router } from "express";
import { advanceTaxController } from "./advance-tax.controller";
import { requireAuth } from "../../middleware/auth";

export const advanceTaxRoutes = Router();

advanceTaxRoutes.use(requireAuth);

advanceTaxRoutes.post("/calculate", advanceTaxController.calculate);
advanceTaxRoutes.get("/", advanceTaxController.list);
