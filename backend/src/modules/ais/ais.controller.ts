import { Response } from "express";
import { aisService } from "./ais.service";
import { importAisSchema, updateAisSchema, listAisQuerySchema } from "./ais.dto";
import { unlockDocumentSchema } from "../documents/documents.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const aisController = {
  import: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const { financialYearCode } = importAisSchema.parse(req.body);
    const result = await aisService.import(
      requireUserId(req),
      financialYearCode,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer,
    );
    sendCreated(res, result);
  }),

  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { financialYearCode } = listAisQuerySchema.parse(req.query);
    const result = await aisService.list(requireUserId(req), financialYearCode);
    sendSuccess(res, result);
  }),

  get: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await aisService.getOwned(requireUserId(req), req.params.id);
    sendSuccess(res, result);
  }),

  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = updateAisSchema.parse(req.body);
    const result = await aisService.update(requireUserId(req), req.params.id, input);
    sendSuccess(res, result);
  }),

  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await aisService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "AIS record deleted" });
  }),

  unlock: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { password } = unlockDocumentSchema.parse(req.body);
    const result = await aisService.unlock(requireUserId(req), req.params.id, password);
    sendSuccess(res, result);
  }),
};
