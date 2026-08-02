import { Router } from "express";
import { z } from "zod";
import { adminController } from "./admin.controller";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireAdmin);

adminRoutes.get("/users", adminController.listUsers);
adminRoutes.patch("/users/:id/active", validate({ body: z.object({ isActive: z.boolean() }) }), adminController.setUserActive);
adminRoutes.patch("/users/:id/role", validate({ body: z.object({ role: z.enum(["USER", "ADMIN"]) }) }), adminController.setUserRole);
adminRoutes.get("/analytics", adminController.analytics);
adminRoutes.get("/audit-logs", adminController.auditLogs);
