import { Response } from "express";
import { fdRateHistoryService } from "./fd-rate-history.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { rateHistoryQuerySchema } from "./fd-rate-history.dto";

export const fdRateHistoryController = {
  getHistory: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = rateHistoryQuerySchema.parse(req.query);
    sendSuccess(res, await fdRateHistoryService.getHistory(req.params.bankId, query));
  }),
  predictTrend: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenureLabel = String(req.query.tenureLabel ?? "1 Year");
    sendSuccess(res, await fdRateHistoryService.predictTrend(req.params.bankId, tenureLabel));
  }),
  record: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { bankId, tenureLabel, interestRate } = req.body;
    sendCreated(res, await fdRateHistoryService.record(bankId, tenureLabel, interestRate));
  }),
};
