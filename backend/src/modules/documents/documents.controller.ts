import { Response } from "express";
import { documentsService } from "./documents.service";
import { uploadDocumentSchema, listDocumentsQuerySchema } from "./documents.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const documentsController = {
  upload: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const { documentType, financialYearCode } = uploadDocumentSchema.parse(req.body);
    const result = await documentsService.upload(
      requireUserId(req),
      documentType,
      financialYearCode,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer,
    );
    sendCreated(res, result);
  }),

  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = listDocumentsQuerySchema.parse(req.query);
    const result = await documentsService.list(requireUserId(req), query);
    sendSuccess(res, result);
  }),

  preview: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { fileName, mimeType, buffer } = await documentsService.getDecryptedContent(requireUserId(req), req.params.id);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
    res.contentType(mimeType);
    res.send(buffer);
  }),

  download: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { fileName, mimeType, buffer } = await documentsService.getDecryptedContent(requireUserId(req), req.params.id);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.contentType(mimeType);
    res.send(buffer);
  }),

  versions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await documentsService.versions(requireUserId(req), req.params.id);
    sendSuccess(res, result);
  }),

  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await documentsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Document deleted" });
  }),
};
