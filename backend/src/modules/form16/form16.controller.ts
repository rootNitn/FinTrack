import { Response } from "express";
import { form16Service } from "./form16.service";
import { importForm16Schema, updateForm16Schema, listForm16QuerySchema } from "./form16.dto";
import { unlockDocumentSchema } from "../documents/documents.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const form16Controller = {
  import: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const { financialYearCode } = importForm16Schema.parse(req.body);
    const result = await form16Service.import(
      requireUserId(req),
      financialYearCode,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer,
    );
    sendCreated(res, result);
  }),

  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { financialYearCode } = listForm16QuerySchema.parse(req.query);
    const result = await form16Service.list(requireUserId(req), financialYearCode);
    sendSuccess(res, result);
  }),

  get: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await form16Service.getOwned(requireUserId(req), req.params.id);
    sendSuccess(res, result);
  }),

  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = updateForm16Schema.parse(req.body);
    const result = await form16Service.update(requireUserId(req), req.params.id, input);
    sendSuccess(res, result);
  }),

  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await form16Service.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Form 16 record deleted" });
  }),

  unlock: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { password } = unlockDocumentSchema.parse(req.body);
    const result = await form16Service.unlock(requireUserId(req), req.params.id, password);
    sendSuccess(res, result);
  }),
};
