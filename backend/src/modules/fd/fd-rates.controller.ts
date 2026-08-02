import { Response } from "express";
import { fdRatesService } from "./fd-rates.service";
import { fdExportService } from "./fd-export.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { comparisonQuerySchema } from "./fd-rates.dto";

export const fdRatesController = {
  compare: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = comparisonQuerySchema.parse(req.query);
    sendSuccess(res, await fdRatesService.compareBanks(query));
  }),
  exportExcel: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = comparisonQuerySchema.parse(req.query);
    const rows = await fdRatesService.compareBanks(query);
    const buffer = await fdExportService.exportComparisonToExcel(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=fd-comparison.xlsx");
    res.send(buffer);
  }),
  exportPdf: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = comparisonQuerySchema.parse(req.query);
    const rows = await fdRatesService.compareBanks(query);
    const buffer = await fdExportService.exportComparisonToPdf(rows);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=fd-comparison.pdf");
    res.send(buffer);
  }),
  listByBank: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdRatesService.listByBank(req.params.bankId));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await fdRatesService.create(req.body));
  }),
  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await fdRatesService.update(req.params.id, req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await fdRatesService.remove(req.params.id);
    sendSuccess(res, { message: "Rate deleted" });
  }),
};
