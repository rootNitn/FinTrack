import { Response } from "express";
import { mutualFundsService } from "./mutual-funds.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const mutualFundsController = {
  getDashboard: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await mutualFundsService.getDashboard(requireUserId(req)));
  }),
};
