import { Response } from "express";
import { reconciliationService } from "./reconciliation.service";
import { reconciliationQuerySchema } from "./reconciliation.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const reconciliationController = {
  report: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { financialYearCode } = reconciliationQuerySchema.parse(req.query);
    const result = await reconciliationService.getReport(requireUserId(req), financialYearCode);
    sendSuccess(res, result);
  }),
};
