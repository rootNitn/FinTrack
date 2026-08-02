import { Router } from "express";
import { hraController } from "./hra.controller";
import { requireAuth } from "../../middleware/auth";

export const hraRoutes = Router();

hraRoutes.use(requireAuth);

hraRoutes.post("/calculate", hraController.calculate);
