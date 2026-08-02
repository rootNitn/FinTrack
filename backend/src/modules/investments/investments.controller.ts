import { Response } from "express";
import { investmentsService } from "./investments.service";
import { investmentsImportExportService } from "./investments.import-export.service";
import { investmentPriceRefreshService } from "./investment-price-refresh.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const investmentsController = {
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { items, meta } = await investmentsService.list(requireUserId(req), req);
    sendSuccess(res, items, 200, meta);
  }),

  categorySummary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await investmentsService.getCategorySummary(requireUserId(req)));
  }),

  getById: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const investment = await investmentsService.getById(requireUserId(req), req.params.id);
    sendSuccess(res, investment);
  }),

  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const investment = await investmentsService.create(requireUserId(req), req.body);
    sendCreated(res, investment);
  }),

  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const investment = await investmentsService.update(requireUserId(req), req.params.id, req.body);
    sendSuccess(res, investment);
  }),

  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await investmentsService.remove(requireUserId(req), req.params.id);
    sendSuccess(res, { message: "Investment deleted" });
  }),

  bulkDelete: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await investmentsService.bulkDelete(requireUserId(req), req.body.ids);
    sendSuccess(res, result);
  }),

  exportExcel: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const buffer = await investmentsImportExportService.exportToExcel(requireUserId(req));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=investments.xlsx");
    res.send(buffer);
  }),

  exportPdf: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const buffer = await investmentsImportExportService.exportToPdf(requireUserId(req));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=investments.pdf");
    res.send(buffer);
  }),

  import: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const result = await investmentsImportExportService.importFromExcel(requireUserId(req), req.file.buffer);
    sendSuccess(res, result);
  }),

  refreshPrices: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await investmentPriceRefreshService.refreshPricesForUser(requireUserId(req));
    sendSuccess(res, result);
  }),
};
