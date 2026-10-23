import { Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { financialLevelService } from "./financial-level.service";

export const financialLevelController = {
  summary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    sendSuccess(res, await financialLevelService.getSummary(req.user.sub));
  }),
};
