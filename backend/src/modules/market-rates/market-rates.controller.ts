import { Request, Response } from "express";
import { marketRatesService } from "./market-rates.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";

export const marketRatesController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await marketRatesService.getLatestRates());
  }),
};
