import { Response } from "express";
import { financialHealthService } from "./financial-health.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const financialHealthController = {
  getSummary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await financialHealthService.getSummary(requireUserId(req));
    sendSuccess(res, result);
  }),
};
