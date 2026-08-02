import { Response } from "express";
import { settingsService } from "./settings.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const settingsController = {
  get: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await settingsService.get(requireUserId(req)));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await settingsService.update(requireUserId(req), req.body));
  }),
  backup: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await settingsService.exportBackup(requireUserId(req));
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=finance-tracker-backup.json");
    res.send(JSON.stringify(data, null, 2));
  }),
};
