import { Router } from "express";
import multer from "multer";
import { aisController } from "./ais.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const aisRoutes = Router();

aisRoutes.use(requireAuth);
aisRoutes.use(requirePlan("PRO"));

aisRoutes.post("/import", upload.single("file"), aisController.import);
aisRoutes.get("/", aisController.list);
aisRoutes.get("/:id", aisController.get);
aisRoutes.patch("/:id", aisController.update);
aisRoutes.delete("/:id", aisController.remove);
aisRoutes.post("/:id/unlock", aisController.unlock);
