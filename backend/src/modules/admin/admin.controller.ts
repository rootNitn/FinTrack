import { Response } from "express";
import { adminService } from "./admin.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";

export const adminController = {
  listUsers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { items, meta } = await adminService.listUsers(req);
    sendSuccess(res, items, 200, meta);
  }),
  setUserActive: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.setUserActive(req.params.id, req.body.isActive));
  }),
  setUserRole: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.setUserRole(req.params.id, req.body.role));
  }),
  analytics: asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.getAnalytics());
  }),
  auditLogs: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { items, meta } = await adminService.listAuditLogs(req);
    sendSuccess(res, items, 200, meta);
  }),
};
