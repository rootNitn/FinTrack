import { Router } from "express";
import multer from "multer";
import { bankImportController } from "./bank-import.controller";
import { requireAuth } from "../../middleware/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const bankImportRoutes = Router();

bankImportRoutes.use(requireAuth);

bankImportRoutes.post("/columns", upload.single("file"), bankImportController.columns);
bankImportRoutes.post("/reconcile", upload.single("file"), bankImportController.reconcile);
bankImportRoutes.post("/commit", bankImportController.commit);
