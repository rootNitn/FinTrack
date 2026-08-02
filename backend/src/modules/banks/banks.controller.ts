import { Response } from "express";
import { banksService } from "./banks.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const banksController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await banksService.list(requireUserId(req)));
  }),
  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await banksService.getById(requireUserId(req), req.params.id));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await banksService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await banksService.update(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await banksService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Bank account deleted" });
  }),
};
