import { Response } from "express";
import { transactionsService } from "./transactions.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

export const transactionsController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { items, meta } = await transactionsService.list(req.user.sub, req);
    sendSuccess(res, items, 200, meta);
  }),

  exportExcel: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const buffer = await transactionsService.exportToExcel(req.user.sub, req);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=transactions.xlsx");
    res.send(buffer);
  }),

  summary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const summary = await transactionsService.summary(req.user.sub, req);
    sendSuccess(res, summary);
  }),

  categories: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const categories = await transactionsService.categories(req.user.sub);
    sendSuccess(res, categories);
  }),

  recent: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const items = await transactionsService.recent(req.user.sub, Number(req.query.limit ?? 8));
    sendSuccess(res, items);
  }),
};
