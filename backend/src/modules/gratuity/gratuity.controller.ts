import { Response } from "express";
import { gratuityService } from "./gratuity.service";
import { calculateGratuitySchema } from "./gratuity.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";

export const gratuityController = {
  calculate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = calculateGratuitySchema.parse(req.body);
    const result = await gratuityService.calculate(input);
    sendSuccess(res, result);
  }),
};
