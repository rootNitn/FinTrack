import { Response } from "express";
import { medicationsService } from "./medications.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const medicationsController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await medicationsService.list(requireUserId(req), req.query.activeOnly === "true"));
  }),
  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await medicationsService.getById(requireUserId(req), req.params.id));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await medicationsService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await medicationsService.update(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await medicationsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Medication deleted" });
  }),
  logDose: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await medicationsService.logDose(requireUserId(req), req.params.id, req.body));
  }),
  getLogs: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await medicationsService.getLogs(requireUserId(req), req.params.id, Number(req.query.limit ?? 90)));
  }),
};
