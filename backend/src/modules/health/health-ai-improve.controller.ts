import { Response } from "express";
import { healthAiImproveService } from "./health-ai-improve.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const healthAiImproveController = {
  improve: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);

    const result = await healthAiImproveService.improve(userId, req.body);
    return sendSuccess(res, result);
  }),

  savePlan: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const result = await healthAiImproveService.savePlan(userId, req.body);
    return sendCreated(res, result);
  }),

  listPlans: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const result = await healthAiImproveService.listPlans(userId);
    return sendSuccess(res, result);
  }),

  getPlan: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const result = await healthAiImproveService.getPlan(userId, req.params.id);
    return sendSuccess(res, result);
  }),

  getPlanForReport: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const result = await healthAiImproveService.getPlanForReport(userId, req.params.reportId);
    return sendSuccess(res, result);
  }),

  regeneratePlan: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const result = await healthAiImproveService.regeneratePlan(userId, req.params.id);
    return sendSuccess(res, result);
  }),

  deletePlan: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    await healthAiImproveService.deletePlan(userId, req.params.id);
    return sendSuccess(res, { deleted: true });
  }),
};
