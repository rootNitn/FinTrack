import { Response } from "express";
import { taxService } from "./tax.service";
import { taxExportService } from "./tax-export.service";
import { taxDashboardService } from "./tax-dashboard.service";
import { taxReportsService, TaxReportType } from "./tax-reports.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { historyQuerySchema } from "./tax.dto";

export const taxController = {
  calculate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxService.calculate(req.body));
  }),
  whatIf: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxService.whatIf(req.body));
  }),
  getSlabs: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const financialYearCode = typeof req.query.financialYearCode === "string" ? req.query.financialYearCode : undefined;
    sendSuccess(res, await taxService.getSlabs(financialYearCode));
  }),
  listFinancialYears: asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxService.listFinancialYears());
  }),
  getDashboard: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    const financialYearCode = typeof req.query.financialYearCode === "string" ? req.query.financialYearCode : undefined;
    if (!financialYearCode) throw AppError.badRequest("financialYearCode query parameter is required");
    sendSuccess(res, await taxDashboardService.getDashboard(req.user.sub, financialYearCode));
  }),
  save: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    sendCreated(res, await taxService.save(req.user.sub, req.body));
  }),
  history: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    const query = historyQuerySchema.parse(req.query);
    const { items, meta } = await taxService.history(req.user.sub, query);
    sendSuccess(res, items, 200, meta);
  }),
  getHistoryItem: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    sendSuccess(res, await taxService.getHistoryItem(req.user.sub, req.params.id));
  }),
  deleteHistoryItem: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    await taxService.deleteHistoryItem(req.user.sub, req.params.id);
    sendSuccess(res, { message: "Saved calculation deleted" });
  }),
  exportExcel: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const comparison = await taxService.calculate(req.body);
    const buffer = await taxExportService.exportToExcel(comparison);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=tax-calculation.xlsx");
    res.send(buffer);
  }),
  exportPdf: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const comparison = await taxService.calculate(req.body);
    const buffer = await taxExportService.exportToPdf(comparison);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=tax-calculation.pdf");
    res.send(buffer);
  }),
  exportHistoryItemExcel: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    const saved = await taxService.getHistoryItem(req.user.sub, req.params.id);
    const buffer = await taxExportService.exportToExcel(saved.result as never);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=tax-calculation.xlsx");
    res.send(buffer);
  }),
  exportHistoryItemPdf: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    const saved = await taxService.getHistoryItem(req.user.sub, req.params.id);
    const buffer = await taxExportService.exportToPdf(saved.result as never);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=tax-calculation.pdf");
    res.send(buffer);
  }),
  getReport: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    const { financialYearCode, reportType } = parseReportQuery(req);
    sendSuccess(res, await taxReportsService.generate(req.user.sub, financialYearCode, reportType));
  }),
  exportReportExcel: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    const { financialYearCode, reportType } = parseReportQuery(req);
    const table = await taxReportsService.generate(req.user.sub, financialYearCode, reportType);
    const buffer = await taxReportsService.exportToExcel(table);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${reportType.toLowerCase()}-report.xlsx`);
    res.send(buffer);
  }),
  exportReportPdf: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.sub) throw AppError.unauthorized();
    const { financialYearCode, reportType } = parseReportQuery(req);
    const table = await taxReportsService.generate(req.user.sub, financialYearCode, reportType);
    const buffer = await taxReportsService.exportToPdf(table);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${reportType.toLowerCase()}-report.pdf`);
    res.send(buffer);
  }),
};

function parseReportQuery(req: AuthenticatedRequest): { financialYearCode: string; reportType: TaxReportType } {
  const financialYearCode = typeof req.query.financialYearCode === "string" ? req.query.financialYearCode : undefined;
  const reportType = typeof req.query.reportType === "string" ? (req.query.reportType as TaxReportType) : undefined;
  if (!financialYearCode) throw AppError.badRequest("financialYearCode query parameter is required");
  if (!reportType) throw AppError.badRequest("reportType query parameter is required");
  return { financialYearCode, reportType };
}
