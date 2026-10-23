import { Router } from "express";
import { upcomingBillsController } from "./upcoming-bills.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { paidBillSchema, snoozeBillSchema } from "./upcoming-bills.dto";

export const upcomingBillsRoutes = Router();

upcomingBillsRoutes.use(requireAuth);

upcomingBillsRoutes.get("/", upcomingBillsController.list);
upcomingBillsRoutes.patch("/:id/paid", validate({ body: paidBillSchema }), upcomingBillsController.markPaid);
upcomingBillsRoutes.patch("/:id/snooze", validate({ body: snoozeBillSchema }), upcomingBillsController.snooze);
