import { Router } from "express";
import { marketRatesController } from "./market-rates.controller";
import { requireAuth } from "../../middleware/auth";

export const marketRatesRoutes = Router();

marketRatesRoutes.use(requireAuth);

marketRatesRoutes.get("/", marketRatesController.list);
