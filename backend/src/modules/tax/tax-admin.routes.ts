import { Router } from "express";
import { taxAdminController } from "./tax-admin.controller";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createCapitalGainRuleSchema,
  createCessRuleSchema,
  createCostInflationIndexSchema,
  createDeductionRuleSchema,
  createFinancialYearSchema,
  createRebateRuleSchema,
  createSlabSchema,
  createSurchargeRuleSchema,
  createValidationRuleSchema,
  updateCapitalGainRuleSchema,
  updateCessRuleSchema,
  updateCostInflationIndexSchema,
  updateDeductionRuleSchema,
  updateFinancialYearSchema,
  updateRebateRuleSchema,
  updateSlabSchema,
  updateSurchargeRuleSchema,
  updateValidationRuleSchema,
} from "./tax-admin.dto";

export const taxAdminRoutes = Router();

taxAdminRoutes.use(requireAuth, requireAdmin);

taxAdminRoutes.get("/financial-years", taxAdminController.listFinancialYears);
taxAdminRoutes.get("/financial-years/:id", taxAdminController.getFinancialYear);
taxAdminRoutes.post("/financial-years", validate({ body: createFinancialYearSchema }), taxAdminController.createFinancialYear);
taxAdminRoutes.patch("/financial-years/:id", validate({ body: updateFinancialYearSchema }), taxAdminController.updateFinancialYear);
taxAdminRoutes.delete("/financial-years/:id", taxAdminController.deleteFinancialYear);

taxAdminRoutes.post("/slabs", validate({ body: createSlabSchema }), taxAdminController.createSlab);
taxAdminRoutes.patch("/slabs/:id", validate({ body: updateSlabSchema }), taxAdminController.updateSlab);
taxAdminRoutes.delete("/slabs/:id", taxAdminController.deleteSlab);

taxAdminRoutes.post("/rebate-rules", validate({ body: createRebateRuleSchema }), taxAdminController.createRebateRule);
taxAdminRoutes.patch("/rebate-rules/:id", validate({ body: updateRebateRuleSchema }), taxAdminController.updateRebateRule);
taxAdminRoutes.delete("/rebate-rules/:id", taxAdminController.deleteRebateRule);

taxAdminRoutes.post("/surcharge-rules", validate({ body: createSurchargeRuleSchema }), taxAdminController.createSurchargeRule);
taxAdminRoutes.patch("/surcharge-rules/:id", validate({ body: updateSurchargeRuleSchema }), taxAdminController.updateSurchargeRule);
taxAdminRoutes.delete("/surcharge-rules/:id", taxAdminController.deleteSurchargeRule);

taxAdminRoutes.post("/cess-rules", validate({ body: createCessRuleSchema }), taxAdminController.createCessRule);
taxAdminRoutes.patch("/cess-rules/:id", validate({ body: updateCessRuleSchema }), taxAdminController.updateCessRule);
taxAdminRoutes.delete("/cess-rules/:id", taxAdminController.deleteCessRule);

taxAdminRoutes.post("/deduction-rules", validate({ body: createDeductionRuleSchema }), taxAdminController.createDeductionRule);
taxAdminRoutes.patch("/deduction-rules/:id", validate({ body: updateDeductionRuleSchema }), taxAdminController.updateDeductionRule);
taxAdminRoutes.delete("/deduction-rules/:id", taxAdminController.deleteDeductionRule);

taxAdminRoutes.get("/capital-gain-rules", taxAdminController.listCapitalGainRules);
taxAdminRoutes.post("/capital-gain-rules", validate({ body: createCapitalGainRuleSchema }), taxAdminController.createCapitalGainRule);
taxAdminRoutes.patch(
  "/capital-gain-rules/:id",
  validate({ body: updateCapitalGainRuleSchema }),
  taxAdminController.updateCapitalGainRule,
);
taxAdminRoutes.delete("/capital-gain-rules/:id", taxAdminController.deleteCapitalGainRule);

taxAdminRoutes.get("/cost-inflation-index", taxAdminController.listCostInflationIndices);
taxAdminRoutes.post(
  "/cost-inflation-index",
  validate({ body: createCostInflationIndexSchema }),
  taxAdminController.createCostInflationIndex,
);
taxAdminRoutes.patch(
  "/cost-inflation-index/:id",
  validate({ body: updateCostInflationIndexSchema }),
  taxAdminController.updateCostInflationIndex,
);
taxAdminRoutes.delete("/cost-inflation-index/:id", taxAdminController.deleteCostInflationIndex);

taxAdminRoutes.get("/validation-rules", taxAdminController.listValidationRules);
taxAdminRoutes.post("/validation-rules", validate({ body: createValidationRuleSchema }), taxAdminController.createValidationRule);
taxAdminRoutes.patch(
  "/validation-rules/:id",
  validate({ body: updateValidationRuleSchema }),
  taxAdminController.updateValidationRule,
);
taxAdminRoutes.delete("/validation-rules/:id", taxAdminController.deleteValidationRule);
