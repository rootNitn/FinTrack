import { Router } from "express";
import { liabilitiesController } from "./liabilities.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createLiabilitySchema, debtPayoffStrategySchema, prepaymentImpactSchema, updateLiabilitySchema } from "./liabilities.dto";

export const liabilitiesRoutes = Router();

liabilitiesRoutes.use(requireAuth);
liabilitiesRoutes.get("/", liabilitiesController.list);
liabilitiesRoutes.get("/debt-payoff-strategy", validate({ query: debtPayoffStrategySchema }), liabilitiesController.debtPayoffStrategy);
liabilitiesRoutes.post("/", validate({ body: createLiabilitySchema }), liabilitiesController.create);
liabilitiesRoutes.get("/:id/amortization", liabilitiesController.amortization);
liabilitiesRoutes.post("/:id/prepayment-impact", validate({ body: prepaymentImpactSchema }), liabilitiesController.prepaymentImpact);
liabilitiesRoutes.patch("/:id", validate({ body: updateLiabilitySchema }), liabilitiesController.update);
liabilitiesRoutes.delete("/:id", liabilitiesController.remove);
