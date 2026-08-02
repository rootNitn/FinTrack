import { Response } from "express";
import { analyticsService } from "./analytics.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const analyticsController = {
  getAnalytics: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await analyticsService.getAnalytics(requireUserId(req)));
  }),
};
