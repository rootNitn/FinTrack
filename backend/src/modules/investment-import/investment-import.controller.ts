import { Response } from "express";
import { investmentImportService } from "./investment-import.service";
import { commitImportSchema, exportFailedRowsSchema, genericCsvMappingSchema } from "./investment-import.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const investmentImportController = {
  parse: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const result = await investmentImportService.parseFile(requireUserId(req), req.file.originalname, req.file.buffer);
    sendSuccess(res, result);
  }),

  columns: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    requireUserId(req);
    const result = await investmentImportService.getColumns(req.file.originalname, req.file.buffer);
    sendSuccess(res, result);
  }),

  parseMapped: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const rawMapping = typeof req.body.mapping === "string" ? JSON.parse(req.body.mapping) : req.body.mapping;
    const mapping = genericCsvMappingSchema.parse(rawMapping);
    const result = await investmentImportService.parseFileWithMapping(
      requireUserId(req),
      req.file.originalname,
      req.file.buffer,
      mapping
    );
    sendSuccess(res, result);
  }),

  commit: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = commitImportSchema.parse(req.body);
    const result = await investmentImportService.commit(requireUserId(req), req.user!.email, input);
    sendSuccess(res, result);
  }),

  history: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const history = await investmentImportService.history(requireUserId(req));
    sendSuccess(res, history);
  }),

  exportFailed: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = exportFailedRowsSchema.parse(req.body);
    const buffer = await investmentImportService.exportFailedRows(input.rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=failed-import-rows.xlsx");
    res.send(buffer);
  }),
};
