import { Router } from "express";
import multer from "multer";
import { fdBanksController } from "./fd-banks.controller";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createFdBankSchema, updateFdBankSchema } from "./fd-banks.dto";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const fdBanksRoutes = Router();

fdBanksRoutes.use(requireAuth);

fdBanksRoutes.get("/", fdBanksController.list);
fdBanksRoutes.post("/import", requireAdmin, upload.single("file"), fdBanksController.import);
fdBanksRoutes.post("/", requireAdmin, validate({ body: createFdBankSchema }), fdBanksController.create);
fdBanksRoutes.get("/:id", fdBanksController.getById);
fdBanksRoutes.patch("/:id", requireAdmin, validate({ body: updateFdBankSchema }), fdBanksController.update);
fdBanksRoutes.delete("/:id", requireAdmin, fdBanksController.remove);
