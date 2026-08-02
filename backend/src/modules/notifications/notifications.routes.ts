import { Router } from "express";
import { notificationsController } from "./notifications.controller";
import { requireAuth } from "../../middleware/auth";

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);
notificationRoutes.get("/", notificationsController.list);
notificationRoutes.get("/unread-count", notificationsController.unreadCount);
notificationRoutes.patch("/:id/read", notificationsController.markRead);
notificationRoutes.patch("/mark-all-read", notificationsController.markAllRead);
notificationRoutes.delete("/:id", notificationsController.remove);
