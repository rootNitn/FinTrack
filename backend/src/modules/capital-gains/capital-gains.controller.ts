import { Response } from "express";
import { capitalGainsService } from "./capital-gains.service";
import { calculateCapitalGainsSchema, listCapitalGainsQuerySchema } from "./capital-gains.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const capitalGainsController = {
  calculate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = calculateCapitalGainsSchema.parse(req.body);
    const result = await capitalGainsService.calculate(requireUserId(req), input);
    sendCreated(res, result);
  }),

  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { financialYearCode } = listCapitalGainsQuerySchema.parse(req.query);
    const result = await capitalGainsService.list(requireUserId(req), financialYearCode);
    sendSuccess(res, result);
  }),

  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await capitalGainsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Capital gains transaction deleted" });
  }),
};
