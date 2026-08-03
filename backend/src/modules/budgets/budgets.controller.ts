import { Response } from "express";
import { budgetsService } from "./budgets.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

function currentMonthYear(req: AuthenticatedRequest): { month: number; year: number } {
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  return { month, year };
}

export const budgetsController = {
  summary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { month, year } = currentMonthYear(req);
    const familyMemberId = typeof req.query.familyMemberId === "string" ? req.query.familyMemberId : undefined;
    sendSuccess(res, await budgetsService.getSummary(requireUserId(req), month, year, familyMemberId));
  }),
  upsert: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await budgetsService.upsert(requireUserId(req), req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await budgetsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Budget deleted" });
  }),
};
