import { Response } from "express";
import { bankImportService } from "./bank-import.service";
import { bankImportCommitSchema, bankImportMappingSchema } from "./bank-import.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const bankImportController = {
  columns: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    requireUserId(req);
    const result = await bankImportService.getColumns(req.file.originalname, req.file.buffer);
    sendSuccess(res, result);
  }),

  reconcile: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const rawMapping = typeof req.body.mapping === "string" ? JSON.parse(req.body.mapping) : req.body.mapping;
    const mapping = bankImportMappingSchema.parse(rawMapping);
    const result = await bankImportService.reconcile(requireUserId(req), req.file.originalname, req.file.buffer, mapping);
    sendSuccess(res, result);
  }),

  commit: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { entries } = bankImportCommitSchema.parse(req.body);
    const result = await bankImportService.commit(requireUserId(req), entries);
    sendSuccess(res, result);
  }),
};
