import { Router } from "express";
import { settingsController } from "./settings.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { updateSettingsSchema, restoreBackupSchema } from "./settings.dto";

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth);
settingsRoutes.get("/", settingsController.get);
settingsRoutes.patch("/", validate({ body: updateSettingsSchema }), settingsController.update);
settingsRoutes.get("/backup", settingsController.backup);
settingsRoutes.post("/restore", validate({ body: restoreBackupSchema }), settingsController.restore);
