import { Response } from "express";
import { taxAdminService } from "./tax-admin.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendCreated, sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";

export const taxAdminController = {
  listFinancialYears: asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.listFinancialYears());
  }),
  getFinancialYear: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.getFinancialYear(req.params.id));
  }),
  createFinancialYear: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await taxAdminService.createFinancialYear(req.body));
  }),
  updateFinancialYear: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.updateFinancialYear(req.params.id, req.body));
  }),
  deleteFinancialYear: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await taxAdminService.deleteFinancialYear(req.params.id);
    sendSuccess(res, { message: "Financial year deleted" });
  }),

  createSlab: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await taxAdminService.createSlab(req.body));
  }),
  updateSlab: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.updateSlab(req.params.id, req.body));
  }),
  deleteSlab: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await taxAdminService.deleteSlab(req.params.id);
    sendSuccess(res, { message: "Slab deleted" });
  }),

  createRebateRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await taxAdminService.createRebateRule(req.body));
  }),
  updateRebateRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.updateRebateRule(req.params.id, req.body));
  }),
  deleteRebateRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await taxAdminService.deleteRebateRule(req.params.id);
    sendSuccess(res, { message: "Rebate rule deleted" });
  }),

  createSurchargeRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await taxAdminService.createSurchargeRule(req.body));
  }),
  updateSurchargeRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.updateSurchargeRule(req.params.id, req.body));
  }),
  deleteSurchargeRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await taxAdminService.deleteSurchargeRule(req.params.id);
    sendSuccess(res, { message: "Surcharge rule deleted" });
  }),

  createCessRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await taxAdminService.createCessRule(req.body));
  }),
  updateCessRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.updateCessRule(req.params.id, req.body));
  }),
  deleteCessRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await taxAdminService.deleteCessRule(req.params.id);
    sendSuccess(res, { message: "Cess rule deleted" });
  }),

  createDeductionRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await taxAdminService.createDeductionRule(req.body));
  }),
  updateDeductionRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.updateDeductionRule(req.params.id, req.body));
  }),
  deleteDeductionRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await taxAdminService.deleteDeductionRule(req.params.id);
    sendSuccess(res, { message: "Deduction rule deleted" });
  }),

  listCapitalGainRules: asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.listCapitalGainRules());
  }),
  createCapitalGainRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await taxAdminService.createCapitalGainRule(req.body));
  }),
  updateCapitalGainRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.updateCapitalGainRule(req.params.id, req.body));
  }),
  deleteCapitalGainRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await taxAdminService.deleteCapitalGainRule(req.params.id);
    sendSuccess(res, { message: "Capital gain rule deleted" });
  }),

  listCostInflationIndices: asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.listCostInflationIndices());
  }),
  createCostInflationIndex: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await taxAdminService.createCostInflationIndex(req.body));
  }),
  updateCostInflationIndex: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.updateCostInflationIndex(req.params.id, req.body));
  }),
  deleteCostInflationIndex: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await taxAdminService.deleteCostInflationIndex(req.params.id);
    sendSuccess(res, { message: "Cost Inflation Index entry deleted" });
  }),

  listValidationRules: asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.listValidationRules());
  }),
  createValidationRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await taxAdminService.createValidationRule(req.body));
  }),
  updateValidationRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await taxAdminService.updateValidationRule(req.params.id, req.body));
  }),
  deleteValidationRule: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await taxAdminService.deleteValidationRule(req.params.id);
    sendSuccess(res, { message: "Validation rule deleted" });
  }),
};
