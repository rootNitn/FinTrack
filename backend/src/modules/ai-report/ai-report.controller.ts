import { Response } from "express";
import { aiReportService } from "./ai-report.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { AiReportImproveRequest } from "./ai-report.dto";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const aiReportController = {
  improve: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(
      res,
      await aiReportService.improve(requireUserId(req), req.body as AiReportImproveRequest)
    );
  }),
};
