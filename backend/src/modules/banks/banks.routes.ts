import { Router } from "express";
import { banksController } from "./banks.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createBankAccountSchema, updateBankAccountSchema } from "./banks.dto";

export const bankRoutes = Router();

bankRoutes.use(requireAuth);
bankRoutes.get("/", banksController.list);
bankRoutes.post("/", validate({ body: createBankAccountSchema }), banksController.create);
bankRoutes.get("/:id", banksController.getById);
bankRoutes.patch("/:id", validate({ body: updateBankAccountSchema }), banksController.update);
bankRoutes.delete("/:id", banksController.remove);
