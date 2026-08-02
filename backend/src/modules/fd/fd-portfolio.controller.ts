import { Response } from "express";
import { fdPortfolioService } from "./fd-portfolio.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const fdPortfolioController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdPortfolioService.list(requireUserId(req)));
  }),
  summary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdPortfolioService.summary(requireUserId(req)));
  }),
  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdPortfolioService.getById(requireUserId(req), req.params.id));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await fdPortfolioService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdPortfolioService.update(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await fdPortfolioService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Portfolio entry deleted" });
  }),
};
