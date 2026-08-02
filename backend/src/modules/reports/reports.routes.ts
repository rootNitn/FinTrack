import { Router } from "express";
import { reportsController } from "./reports.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { reportQuerySchema } from "./reports.dto";

export const reportRoutes = Router();

reportRoutes.use(requireAuth);
reportRoutes.get("/", validate({ query: reportQuerySchema }), reportsController.generate);
reportRoutes.get("/export/excel", validate({ query: reportQuerySchema }), reportsController.exportExcel);
reportRoutes.get("/export/csv", validate({ query: reportQuerySchema }), reportsController.exportCsv);
reportRoutes.get("/export/pdf", validate({ query: reportQuerySchema }), reportsController.exportPdf);
