import { Router } from "express";
import multer from "multer";
import { healthReportsController } from "./health-reports.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createHealthReportResultSchema, updateHealthReportResultSchema, updateHealthReportSchema } from "./health-reports.dto";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const healthReportsRoutes = Router();

healthReportsRoutes.use(requireAuth);

// Specific paths before "/:id" so they aren't swallowed by the id param route.
healthReportsRoutes.post("/upload", upload.single("file"), healthReportsController.upload);
healthReportsRoutes.get("/tests", healthReportsController.listTestNames);
healthReportsRoutes.get("/compare", healthReportsController.compare);
healthReportsRoutes.get("/", healthReportsController.list);
healthReportsRoutes.get("/:id", healthReportsController.getById);
healthReportsRoutes.patch("/:id", validate({ body: updateHealthReportSchema }), healthReportsController.update);
healthReportsRoutes.delete("/:id", healthReportsController.remove);
healthReportsRoutes.post("/:id/results", validate({ body: createHealthReportResultSchema }), healthReportsController.addResult);
healthReportsRoutes.patch(
  "/:id/results/:resultId",
  validate({ body: updateHealthReportResultSchema }),
  healthReportsController.updateResult
);
healthReportsRoutes.delete("/:id/results/:resultId", healthReportsController.removeResult);
