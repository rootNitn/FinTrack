import { Response } from "express";
import { healthReportsService } from "./health-reports.service";
import { uploadHealthReportSchema } from "./health-reports.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const healthReportsController = {
  upload: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const { reportDate, testDate, labName, password } = uploadHealthReportSchema.parse(req.body);
    const result = await healthReportsService.upload(
      requireUserId(req),
      reportDate,
      testDate,
      labName,
      password,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer
    );
    sendCreated(res, result);
  }),

  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await healthReportsService.list(requireUserId(req)));
  }),

  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await healthReportsService.getById(requireUserId(req), req.params.id));
  }),

  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await healthReportsService.updateMeta(requireUserId(req), req.params.id, req.body));
  }),

  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await healthReportsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Health report deleted" });
  }),

  addResult: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await healthReportsService.addResult(requireUserId(req), req.params.id, req.body));
  }),

  updateResult: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(
      res,
      await healthReportsService.updateResult(requireUserId(req), req.params.id, req.params.resultId, req.body)
    );
  }),

  removeResult: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await healthReportsService.removeResult(requireUserId(req), req.params.id, req.params.resultId);
    sendSuccess(res, { message: "Result deleted" });
  }),

  listTestNames: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await healthReportsService.listTestNames(requireUserId(req)));
  }),

  compare: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const testName = typeof req.query.testName === "string" ? req.query.testName : "";
    if (!testName) throw AppError.badRequest("testName query parameter is required");
    sendSuccess(res, await healthReportsService.compare(requireUserId(req), testName));
  }),
};
