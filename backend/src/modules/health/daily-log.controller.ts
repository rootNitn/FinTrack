import { Response } from "express";
import { dailyLogService } from "./daily-log.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const dailyLogController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await dailyLogService.list(requireUserId(req), Number(req.query.days ?? 30)));
  }),
  today: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await dailyLogService.getByDate(requireUserId(req), todayStr()));
  }),
  getByDate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await dailyLogService.getByDate(requireUserId(req), req.params.date));
  }),
  upsert: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await dailyLogService.upsert(requireUserId(req), req.params.date, req.body));
  }),
};
