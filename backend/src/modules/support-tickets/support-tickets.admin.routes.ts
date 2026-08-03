import { Router } from "express";
import { supportTicketsController } from "./support-tickets.controller";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { updateTicketAdminSchema } from "./support-tickets.dto";

export const supportTicketAdminRoutes = Router();

supportTicketAdminRoutes.use(requireAuth, requireAdmin);
supportTicketAdminRoutes.get("/", supportTicketsController.listAll);
supportTicketAdminRoutes.get("/:id", supportTicketsController.getByIdAdmin);
supportTicketAdminRoutes.patch("/:id", validate({ body: updateTicketAdminSchema }), supportTicketsController.updateAdmin);
