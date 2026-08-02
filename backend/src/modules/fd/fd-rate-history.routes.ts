import { Router } from "express";
import { fdRateHistoryController } from "./fd-rate-history.controller";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { recordRateHistorySchema } from "./fd-rate-history.dto";

export const fdRateHistoryRoutes = Router();

fdRateHistoryRoutes.use(requireAuth);

fdRateHistoryRoutes.get("/:bankId", fdRateHistoryController.getHistory);
fdRateHistoryRoutes.get("/:bankId/trend", fdRateHistoryController.predictTrend);
fdRateHistoryRoutes.post("/", requireAdmin, validate({ body: recordRateHistorySchema }), fdRateHistoryController.record);
