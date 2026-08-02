import { Router } from "express";
import { transactionsController } from "./transactions.controller";
import { requireAuth } from "../../middleware/auth";

export const transactionRoutes = Router();

transactionRoutes.use(requireAuth);
transactionRoutes.get("/recent", transactionsController.recent);
transactionRoutes.get("/", transactionsController.list);
