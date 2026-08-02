import { Response } from "express";
import { leaveEncashmentService } from "./leave-encashment.service";
import { calculateLeaveEncashmentSchema } from "./leave-encashment.dto";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";

export const leaveEncashmentController = {
  calculate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = calculateLeaveEncashmentSchema.parse(req.body);
    const result = await leaveEncashmentService.calculate(input);
    sendSuccess(res, result);
  }),
};
