import { Response } from "express";
import { hraService } from "./hra.service";
import { calculateHraSchema } from "./hra.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";

export const hraController = {
  calculate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = calculateHraSchema.parse(req.body);
    const result = hraService.calculate(input);
    sendSuccess(res, result);
  }),
};
