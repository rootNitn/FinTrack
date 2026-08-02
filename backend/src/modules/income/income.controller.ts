import { Response } from "express";
import { incomeService } from "./income.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const incomeController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { items, meta } = await incomeService.list(requireUserId(req), req);
    sendSuccess(res, items, 200, meta);
  }),
  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await incomeService.getById(requireUserId(req), req.params.id));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await incomeService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await incomeService.update(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await incomeService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Income deleted" });
  }),
};
