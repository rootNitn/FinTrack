import { Response } from "express";
import { bodyMetricsService } from "./body-metrics.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const bodyMetricsController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await bodyMetricsService.list(requireUserId(req), Number(req.query.limit ?? 90)));
  }),
  latest: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await bodyMetricsService.latest(requireUserId(req)));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await bodyMetricsService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await bodyMetricsService.update(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await bodyMetricsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Body metric log deleted" });
  }),
};
