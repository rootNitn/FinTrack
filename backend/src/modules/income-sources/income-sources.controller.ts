import { Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { incomeSourcesService } from "./income-sources.service";

function userId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const incomeSourcesController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => sendSuccess(res, await incomeSourcesService.list(userId(req)))),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => sendCreated(res, await incomeSourcesService.create(userId(req), req.body))),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => sendSuccess(res, await incomeSourcesService.update(userId(req), req.params.id, req.body))),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await incomeSourcesService.remove(userId(req), req.params.id);
    sendSuccess(res, { message: "Income source deleted" });
  }),
};
