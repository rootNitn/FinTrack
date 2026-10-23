import { Response } from "express";
import { liabilitiesService } from "./liabilities.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { DebtPayoffStrategyInput } from "./liabilities.dto";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const liabilitiesController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await liabilitiesService.list(requireUserId(req)));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await liabilitiesService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await liabilitiesService.update(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await liabilitiesService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Liability deleted" });
  }),
  amortization: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await liabilitiesService.getAmortization(requireUserId(req), req.params.id));
  }),
  prepaymentImpact: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await liabilitiesService.getPrepaymentImpact(requireUserId(req), req.params.id, req.body));
  }),
  debtPayoffStrategy: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await liabilitiesService.getDebtPayoffStrategy(requireUserId(req), req.query as unknown as DebtPayoffStrategyInput));
  }),
};
