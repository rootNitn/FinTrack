import { Router } from "express";
import multer from "multer";
import { form26ASController } from "./form26as.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const form26ASRoutes = Router();

form26ASRoutes.use(requireAuth);
form26ASRoutes.use(requirePlan("PRO"));

form26ASRoutes.post("/import", upload.single("file"), form26ASController.import);
form26ASRoutes.get("/", form26ASController.list);
form26ASRoutes.get("/:id", form26ASController.get);
form26ASRoutes.patch("/:id", form26ASController.update);
form26ASRoutes.delete("/:id", form26ASController.remove);
form26ASRoutes.post("/:id/unlock", form26ASController.unlock);
