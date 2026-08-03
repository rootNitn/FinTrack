import { Response } from "express";
import { expensesService } from "./expenses.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const expensesController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { items, meta } = await expensesService.list(requireUserId(req), req);
    sendSuccess(res, items, 200, meta);
  }),
  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await expensesService.getById(requireUserId(req), req.params.id));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await expensesService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await expensesService.update(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await expensesService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Expense deleted" });
  }),
  uploadReceipt: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const publicUrl = `/uploads/receipts/${req.file.filename}`;
    sendSuccess(res, await expensesService.uploadReceipt(requireUserId(req), req.params.id, publicUrl));
  }),
  scanReceipt: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const publicUrl = `/uploads/receipts/${req.file.filename}`;
    sendSuccess(res, await expensesService.scanReceipt(req.file.path, req.file.mimetype, publicUrl));
  }),
  spendingTrends: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const months = req.query.months ? Number(req.query.months) : undefined;
    sendSuccess(res, await expensesService.getSpendingTrends(requireUserId(req), months));
  }),
  setSplitSettled: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(
      res,
      await expensesService.setSplitSettled(requireUserId(req), req.params.expenseId, req.params.splitId, req.body.isSettled)
    );
  }),
  splitsSummary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await expensesService.getSplitsSummary(requireUserId(req)));
  }),
};
