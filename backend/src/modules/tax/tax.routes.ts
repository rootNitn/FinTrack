import { Router } from "express";
import { taxController } from "./tax.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { calculateTaxSchema, saveTaxCalculationSchema, whatIfTaxSchema } from "./tax.dto";

export const taxRoutes = Router();

taxRoutes.use(requireAuth);

taxRoutes.get("/financial-years", taxController.listFinancialYears);
taxRoutes.get("/slabs", taxController.getSlabs);
taxRoutes.get("/dashboard", taxController.getDashboard);

taxRoutes.post("/calculate", validate({ body: calculateTaxSchema }), taxController.calculate);
taxRoutes.post("/what-if", validate({ body: whatIfTaxSchema }), taxController.whatIf);

taxRoutes.post("/export/excel", validate({ body: calculateTaxSchema }), taxController.exportExcel);
taxRoutes.post("/export/pdf", validate({ body: calculateTaxSchema }), taxController.exportPdf);

taxRoutes.post("/save", validate({ body: saveTaxCalculationSchema }), taxController.save);
taxRoutes.get("/history", taxController.history);
taxRoutes.get("/history/:id", taxController.getHistoryItem);
taxRoutes.delete("/history/:id", taxController.deleteHistoryItem);
taxRoutes.get("/history/:id/export/excel", taxController.exportHistoryItemExcel);
taxRoutes.get("/history/:id/export/pdf", taxController.exportHistoryItemPdf);

taxRoutes.get("/reports", taxController.getReport);
taxRoutes.get("/reports/export/excel", taxController.exportReportExcel);
taxRoutes.get("/reports/export/pdf", taxController.exportReportPdf);
