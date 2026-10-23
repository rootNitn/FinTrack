import { Response } from "express";
import { VitalType } from "@prisma/client";
import { vitalsService } from "./vitals.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const vitalsController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const type = typeof req.query.type === "string" ? (req.query.type as VitalType) : undefined;
    sendSuccess(res, await vitalsService.list(requireUserId(req), type, Number(req.query.limit ?? 90)));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await vitalsService.create(requireUserId(req), req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await vitalsService.update(requireUserId(req), req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await vitalsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Vital log deleted" });
  }),
};
