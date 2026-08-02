import { Router } from "express";
import { fdCalculateController } from "./fd-calculate.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { calculateFdSchema, ladderPlanSchema } from "./fd-calculate.dto";

export const fdCalculateRoutes = Router();

fdCalculateRoutes.use(requireAuth);

fdCalculateRoutes.post("/calculate", validate({ body: calculateFdSchema }), fdCalculateController.calculate);
fdCalculateRoutes.post("/ladder-plan", validate({ body: ladderPlanSchema }), fdCalculateController.ladderPlan);
