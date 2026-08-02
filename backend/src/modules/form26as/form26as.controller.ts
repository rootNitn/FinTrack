import { Response } from "express";
import { form26ASService } from "./form26as.service";
import { importForm26ASSchema, updateForm26ASSchema, listForm26ASQuerySchema } from "./form26as.dto";
import { unlockDocumentSchema } from "../documents/documents.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const form26ASController = {
  import: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const { financialYearCode } = importForm26ASSchema.parse(req.body);
    const result = await form26ASService.import(
      requireUserId(req),
      financialYearCode,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer,
    );
    sendCreated(res, result);
  }),

  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { financialYearCode } = listForm26ASQuerySchema.parse(req.query);
    const result = await form26ASService.list(requireUserId(req), financialYearCode);
    sendSuccess(res, result);
  }),

  get: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await form26ASService.getOwned(requireUserId(req), req.params.id);
    sendSuccess(res, result);
  }),

  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = updateForm26ASSchema.parse(req.body);
    const result = await form26ASService.update(requireUserId(req), req.params.id, input);
    sendSuccess(res, result);
  }),

  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await form26ASService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Form 26AS record deleted" });
  }),

  unlock: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { password } = unlockDocumentSchema.parse(req.body);
    const result = await form26ASService.unlock(requireUserId(req), req.params.id, password);
    sendSuccess(res, result);
  }),
};
