import { Router } from "express";
import { fdRatesController } from "./fd-rates.controller";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createFdRateSchema, updateFdRateSchema } from "./fd-rates.dto";

export const fdRatesRoutes = Router();

fdRatesRoutes.use(requireAuth);

fdRatesRoutes.get("/", fdRatesController.compare);
fdRatesRoutes.get("/export/excel", fdRatesController.exportExcel);
fdRatesRoutes.get("/export/pdf", fdRatesController.exportPdf);
fdRatesRoutes.get("/bank/:bankId", fdRatesController.listByBank);
fdRatesRoutes.post("/", requireAdmin, validate({ body: createFdRateSchema }), fdRatesController.create);
fdRatesRoutes.patch("/:id", requireAdmin, validate({ body: updateFdRateSchema }), fdRatesController.update);
fdRatesRoutes.delete("/:id", requireAdmin, fdRatesController.remove);
