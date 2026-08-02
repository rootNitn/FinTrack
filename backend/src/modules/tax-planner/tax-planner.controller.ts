import { Response } from "express";
import { taxPlannerService } from "./tax-planner.service";
import { generateTaxPlanSchema } from "./tax-planner.dto";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess, sendCreated } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

const listQuerySchema = z.object({ financialYearCode: z.string().min(1).optional() });
const latestQuerySchema = z.object({ financialYearCode: z.string().min(1) });

export const taxPlannerController = {
  generate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = generateTaxPlanSchema.parse(req.body);
    const result = await taxPlannerService.generatePlan(requireUserId(req), input);
    sendCreated(res, result);
  }),

  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { financialYearCode } = listQuerySchema.parse(req.query);
    const result = await taxPlannerService.list(requireUserId(req), financialYearCode);
    sendSuccess(res, result);
  }),

  latest: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { financialYearCode } = latestQuerySchema.parse(req.query);
    const result = await taxPlannerService.getLatest(requireUserId(req), financialYearCode);
    sendSuccess(res, result);
  }),
};
