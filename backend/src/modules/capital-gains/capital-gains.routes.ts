import { Router } from "express";
import { capitalGainsController } from "./capital-gains.controller";
import { requireAuth } from "../../middleware/auth";

export const capitalGainsRoutes = Router();

capitalGainsRoutes.use(requireAuth);

capitalGainsRoutes.post("/calculate", capitalGainsController.calculate);
capitalGainsRoutes.get("/", capitalGainsController.list);
capitalGainsRoutes.delete("/:id", capitalGainsController.remove);
