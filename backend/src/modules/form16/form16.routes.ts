import { Router } from "express";
import multer from "multer";
import { form16Controller } from "./form16.controller";
import { requireAuth } from "../../middleware/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const form16Routes = Router();

form16Routes.use(requireAuth);

form16Routes.post("/import", upload.single("file"), form16Controller.import);
form16Routes.get("/", form16Controller.list);
form16Routes.get("/:id", form16Controller.get);
form16Routes.patch("/:id", form16Controller.update);
form16Routes.delete("/:id", form16Controller.remove);
form16Routes.post("/:id/unlock", form16Controller.unlock);
