import { Response } from "express";
import { goalsService } from "./goals.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const goalsController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const familyMemberId = typeof req.query.familyMemberId === "string" ? req.query.familyMemberId : undefined;
    sendSuccess(res, await goalsService.list(requireUserId(req), familyMemberId));
  }),
  upcoming: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await goalsService.upcoming(requireUserId(req), Number(req.query.limit ?? 5)));
  }),
  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await goalsService.getById(requireUserId(req), req.params.id));
  }),
  contributions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await goalsService.contributions(requireUserId(req), req.params.id));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await goalsService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await goalsService.update(requireUserId(req), req.params.id, req.body));
  }),
  addContribution: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await goalsService.addContribution(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await goalsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Goal deleted" });
  }),
};
