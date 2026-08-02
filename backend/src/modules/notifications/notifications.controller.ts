import { Response } from "express";
import { notificationsService } from "./notifications.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const notificationsController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await notificationsService.list(requireUserId(req), req.query.unreadOnly === "true"));
  }),
  unreadCount: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, { count: await notificationsService.unreadCount(requireUserId(req)) });
  }),
  markRead: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await notificationsService.markRead(requireUserId(req), req.params.id));
  }),
  markAllRead: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await notificationsService.markAllRead(requireUserId(req)));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await notificationsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Notification deleted" });
  }),
};
