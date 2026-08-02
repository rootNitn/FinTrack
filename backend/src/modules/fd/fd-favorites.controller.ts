import { Response } from "express";
import { fdFavoritesService } from "./fd-favorites.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const fdFavoritesController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdFavoritesService.list(requireUserId(req)));
  }),
  add: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await fdFavoritesService.add(requireUserId(req), req.body.bankId));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await fdFavoritesService.remove(requireUserId(req), req.params.bankId);
    sendSuccess(res, { message: "Removed from favorites" });
  }),
};
