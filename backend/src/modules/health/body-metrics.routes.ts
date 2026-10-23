import { Router } from "express";
import { bodyMetricsController } from "./body-metrics.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createBodyMetricSchema, updateBodyMetricSchema } from "./body-metrics.dto";

export const bodyMetricsRoutes = Router();

bodyMetricsRoutes.use(requireAuth);
bodyMetricsRoutes.get("/latest", bodyMetricsController.latest);
bodyMetricsRoutes.get("/", bodyMetricsController.list);
bodyMetricsRoutes.post("/", validate({ body: createBodyMetricSchema }), bodyMetricsController.create);
bodyMetricsRoutes.patch("/:id", validate({ body: updateBodyMetricSchema }), bodyMetricsController.update);
bodyMetricsRoutes.delete("/:id", bodyMetricsController.remove);
