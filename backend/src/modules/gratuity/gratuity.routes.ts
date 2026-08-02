import { Router } from "express";
import { gratuityController } from "./gratuity.controller";
import { requireAuth } from "../../middleware/auth";

export const gratuityRoutes = Router();

gratuityRoutes.use(requireAuth);

gratuityRoutes.post("/calculate", gratuityController.calculate);
