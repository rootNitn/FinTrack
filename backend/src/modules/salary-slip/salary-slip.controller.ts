import { Response } from "express";
import { salarySlipService } from "./salary-slip.service";
import { importSalarySlipSchema, updateSalarySlipSchema, listSalarySlipQuerySchema } from "./salary-slip.dto";
import { unlockDocumentSchema } from "../documents/documents.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const salarySlipController = {
  import: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const { financialYearCode } = importSalarySlipSchema.parse(req.body);
    const result = await salarySlipService.import(
      requireUserId(req),
      financialYearCode,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer,
    );
    sendCreated(res, result);
  }),

  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { financialYearCode } = listSalarySlipQuerySchema.parse(req.query);
    const result = await salarySlipService.list(requireUserId(req), financialYearCode);
    sendSuccess(res, result);
  }),

  get: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await salarySlipService.getOwned(requireUserId(req), req.params.id);
    sendSuccess(res, result);
  }),

  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = updateSalarySlipSchema.parse(req.body);
    const result = await salarySlipService.update(requireUserId(req), req.params.id, input);
    sendSuccess(res, result);
  }),

  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await salarySlipService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Salary slip record deleted" });
  }),

  unlock: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { password } = unlockDocumentSchema.parse(req.body);
    const result = await salarySlipService.unlock(requireUserId(req), req.params.id, password);
    sendSuccess(res, result);
  }),
};
