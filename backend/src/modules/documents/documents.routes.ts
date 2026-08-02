import { Router } from "express";
import multer from "multer";
import { documentsController } from "./documents.controller";
import { requireAuth } from "../../middleware/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const documentsRoutes = Router();

documentsRoutes.use(requireAuth);

documentsRoutes.post("/upload", upload.single("file"), documentsController.upload);
documentsRoutes.get("/", documentsController.list);
documentsRoutes.get("/:id/preview", documentsController.preview);
documentsRoutes.get("/:id/download", documentsController.download);
documentsRoutes.get("/:id/versions", documentsController.versions);
documentsRoutes.delete("/:id", documentsController.remove);
