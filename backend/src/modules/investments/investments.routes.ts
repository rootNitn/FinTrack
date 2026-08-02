import { Router } from "express";
import multer from "multer";
import { investmentsController } from "./investments.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { bulkDeleteSchema, createInvestmentSchema, updateInvestmentSchema } from "./investments.dto";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const investmentRoutes = Router();

investmentRoutes.use(requireAuth);

investmentRoutes.get("/export/excel", investmentsController.exportExcel);
investmentRoutes.get("/export/pdf", investmentsController.exportPdf);
investmentRoutes.get("/category-summary", investmentsController.categorySummary);
investmentRoutes.post("/import", upload.single("file"), investmentsController.import);
investmentRoutes.post("/bulk-delete", validate({ body: bulkDeleteSchema }), investmentsController.bulkDelete);
investmentRoutes.post("/refresh-prices", investmentsController.refreshPrices);

investmentRoutes.get("/", investmentsController.list);
investmentRoutes.post("/", validate({ body: createInvestmentSchema }), investmentsController.create);
investmentRoutes.get("/:id", investmentsController.getById);
investmentRoutes.patch("/:id", validate({ body: updateInvestmentSchema }), investmentsController.update);
investmentRoutes.delete("/:id", investmentsController.remove);
