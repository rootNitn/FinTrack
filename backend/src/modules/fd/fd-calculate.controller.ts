import { Response } from "express";
import { fdCalculateService } from "./fd-calculate.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";

export const fdCalculateController = {
  calculate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdCalculateService.calculate(req.user?.sub, req.body));
  }),
  ladderPlan: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdCalculateService.buildLadderPlan(req.body));
  }),
};
