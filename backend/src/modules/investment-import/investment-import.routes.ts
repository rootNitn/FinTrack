import { Router } from "express";
import multer from "multer";
import { investmentImportController } from "./investment-import.controller";
import { requireAuth } from "../../middleware/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const investmentImportRoutes = Router();

investmentImportRoutes.use(requireAuth);

investmentImportRoutes.post("/parse", upload.single("file"), investmentImportController.parse);
investmentImportRoutes.post("/columns", upload.single("file"), investmentImportController.columns);
investmentImportRoutes.post("/parse-mapped", upload.single("file"), investmentImportController.parseMapped);
investmentImportRoutes.post("/commit", investmentImportController.commit);
investmentImportRoutes.post("/export-failed", investmentImportController.exportFailed);
investmentImportRoutes.get("/history", investmentImportController.history);
