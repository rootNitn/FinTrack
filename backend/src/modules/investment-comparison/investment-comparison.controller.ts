import { Response } from "express";
import { investmentComparisonService } from "./investment-comparison.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { compareInvestmentsQuerySchema } from "./investment-comparison.dto";

export const investmentComparisonController = {
  compare: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = compareInvestmentsQuerySchema.parse(req.query);
    sendSuccess(res, await investmentComparisonService.compare(query));
  }),
};
