import { Response } from "express";
import { supportTicketsService } from "./support-tickets.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const supportTicketsController = {
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await supportTicketsService.create(requireUserId(req), req.body));
  }),
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { items, meta } = await supportTicketsService.list(requireUserId(req), req);
    sendSuccess(res, items, 200, meta);
  }),
  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await supportTicketsService.getById(requireUserId(req), req.params.id));
  }),

  // --- Admin ---
  listAll: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { items, meta } = await supportTicketsService.listAll(req);
    sendSuccess(res, items, 200, meta);
  }),
  getByIdAdmin: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await supportTicketsService.getByIdAdmin(req.params.id));
  }),
  updateAdmin: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await supportTicketsService.updateAdmin(req.params.id, req.body));
  }),
};
