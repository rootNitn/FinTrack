import { Response } from "express";
import { analyticsService } from "./analytics.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

function parseBoundary(value: unknown, endOfDay: boolean): Date | undefined {
  if (typeof value !== "string") return undefined;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isDateOnly ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value);
  if (Number.isNaN(date.getTime()) || (isDateOnly && date.toISOString().slice(0, 10) !== value)) {
    throw AppError.badRequest("Invalid analytics date range");
  }
  return date;
}

export function parseAnalyticsDateRange(startValue: unknown, endValue: unknown) {
  const startDate = parseBoundary(startValue, false);
  const endDate = parseBoundary(endValue, true);
  if (startDate && endDate && startDate > endDate) throw AppError.badRequest("Start date must be before end date");
  return { startDate, endDate };
}

function parseRange(req: AuthenticatedRequest) {
  return parseAnalyticsDateRange(req.query.startDate, req.query.endDate);
}

export const analyticsController = {
  getAnalytics: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await analyticsService.getAnalytics(requireUserId(req), parseRange(req)));
  }),

  exportExcel: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const buffer = await analyticsService.exportExcel(requireUserId(req), parseRange(req));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=analytics.xlsx");
    res.send(buffer);
  }),

  exportPdf: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const buffer = await analyticsService.exportPdf(requireUserId(req), parseRange(req));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=analytics.pdf");
    res.send(buffer);
  }),
};
