import { Response } from "express";
import { upcomingBillsService } from "./upcoming-bills.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const upcomingBillsController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestedDays = Number(req.query.days);
    const windowDays = Number.isFinite(requestedDays) && requestedDays > 0 ? Math.min(requestedDays, 365) : 30;
    sendSuccess(res, await upcomingBillsService.getUpcomingBills(requireUserId(req), windowDays));
  }),
  markPaid: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await upcomingBillsService.updateBill(requireUserId(req), req.params.id, "paid", req.body.paidDate));
  }),
  snooze: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await upcomingBillsService.updateBill(requireUserId(req), req.params.id, "snooze", req.body.snoozedUntil));
  }),
};
