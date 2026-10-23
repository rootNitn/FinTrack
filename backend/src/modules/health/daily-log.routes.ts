import { Router } from "express";
import { dailyLogController } from "./daily-log.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { dailyLogDateParamSchema, upsertDailyLogSchema } from "./daily-log.dto";

export const dailyLogRoutes = Router();

dailyLogRoutes.use(requireAuth);
dailyLogRoutes.get("/today", dailyLogController.today);
dailyLogRoutes.get("/", dailyLogController.list);
dailyLogRoutes.get("/:date", validate({ params: dailyLogDateParamSchema }), dailyLogController.getByDate);
dailyLogRoutes.put(
  "/:date",
  validate({ params: dailyLogDateParamSchema, body: upsertDailyLogSchema }),
  dailyLogController.upsert
);
