import { Response } from "express";
import { reportsService } from "./reports.service";
import { reportsExportService } from "./reports.export.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const reportsController = {
  generate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await reportsService.generate(requireUserId(req), req.query as never));
  }),

  exportExcel: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const report = await reportsService.generate(requireUserId(req), req.query as never);
    const buffer = await reportsExportService.toExcel(report);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${report.type}-report.xlsx`);
    res.send(buffer);
  }),

  exportCsv: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const report = await reportsService.generate(requireUserId(req), req.query as never);
    const csv = reportsExportService.toCsv(report);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${report.type}-report.csv`);
    res.send(csv);
  }),

  exportPdf: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const report = await reportsService.generate(requireUserId(req), req.query as never);
    const buffer = await reportsExportService.toPdf(report);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${report.type}-report.pdf`);
    res.send(buffer);
  }),
};
