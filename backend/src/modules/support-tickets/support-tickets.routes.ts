import { Router } from "express";
import { supportTicketsController } from "./support-tickets.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createTicketSchema } from "./support-tickets.dto";

export const supportTicketRoutes = Router();

supportTicketRoutes.use(requireAuth);
supportTicketRoutes.get("/", supportTicketsController.list);
supportTicketRoutes.post("/", validate({ body: createTicketSchema }), supportTicketsController.create);
supportTicketRoutes.get("/:id", supportTicketsController.getById);
