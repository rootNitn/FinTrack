import { Router } from "express";
import { mutualFundsController } from "./mutual-funds.controller";
import { requireAuth } from "../../middleware/auth";

export const mutualFundsRoutes = Router();

mutualFundsRoutes.use(requireAuth);

mutualFundsRoutes.get("/dashboard", mutualFundsController.getDashboard);
mutualFundsRoutes.get("/funds/:key", mutualFundsController.getFundDetail);
