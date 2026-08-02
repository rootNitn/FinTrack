import { Response } from "express";
import { dashboardService } from "./dashboard.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const dashboardController = {
  summary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await dashboardService.getSummary(requireUserId(req)));
  }),
  kpis: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await dashboardService.getKpis(requireUserId(req)));
  }),
};
