import { Router } from "express";
import multer from "multer";
import { salarySlipController } from "./salary-slip.controller";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/require-plan";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const salarySlipRoutes = Router();

salarySlipRoutes.use(requireAuth);
salarySlipRoutes.use(requirePlan("PRO"));

salarySlipRoutes.post("/import", upload.single("file"), salarySlipController.import);
salarySlipRoutes.get("/", salarySlipController.list);
salarySlipRoutes.get("/:id", salarySlipController.get);
salarySlipRoutes.patch("/:id", salarySlipController.update);
salarySlipRoutes.delete("/:id", salarySlipController.remove);
salarySlipRoutes.post("/:id/unlock", salarySlipController.unlock);
