import { Response } from "express";
import { advanceTaxService } from "./advance-tax.service";
import { calculateAdvanceTaxSchema, listAdvanceTaxQuerySchema } from "./advance-tax.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const advanceTaxController = {
  calculate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = calculateAdvanceTaxSchema.parse(req.body);
    const result = await advanceTaxService.calculate(requireUserId(req), input);
    sendCreated(res, result);
  }),

  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { financialYearCode } = listAdvanceTaxQuerySchema.parse(req.query);
    const result = await advanceTaxService.list(requireUserId(req), financialYearCode);
    sendSuccess(res, result);
  }),
};
