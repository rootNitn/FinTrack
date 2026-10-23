import { Response } from "express";
import { healthSummaryService } from "./health-summary.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

export const healthSummaryController = {
  get: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    sendSuccess(res, await healthSummaryService.get(req.user.sub));
  }),
};
