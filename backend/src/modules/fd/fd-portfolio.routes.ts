import { Router } from "express";
import { fdPortfolioController } from "./fd-portfolio.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createFdPortfolioSchema, prematureWithdrawalSchema, renewFdPortfolioSchema, updateFdPortfolioSchema } from "./fd-portfolio.dto";

export const fdPortfolioRoutes = Router();

fdPortfolioRoutes.use(requireAuth);

fdPortfolioRoutes.get("/", fdPortfolioController.list);
fdPortfolioRoutes.get("/summary", fdPortfolioController.summary);
fdPortfolioRoutes.get("/:id", fdPortfolioController.getById);
fdPortfolioRoutes.post("/", validate({ body: createFdPortfolioSchema }), fdPortfolioController.create);
fdPortfolioRoutes.post("/:id/premature-withdrawal", validate({ body: prematureWithdrawalSchema }), fdPortfolioController.prematureWithdraw);
fdPortfolioRoutes.post("/:id/renew", validate({ body: renewFdPortfolioSchema }), fdPortfolioController.renew);
fdPortfolioRoutes.patch("/:id", validate({ body: updateFdPortfolioSchema }), fdPortfolioController.update);
fdPortfolioRoutes.delete("/:id", fdPortfolioController.remove);
