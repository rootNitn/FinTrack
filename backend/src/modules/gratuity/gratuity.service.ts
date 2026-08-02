import { taxRulesService } from "../tax/tax-rules.service";
import { CalculateGratuityInput } from "./gratuity.dto";

/** Statutory lifetime gratuity exemption cap (Payment of Gratuity Act, as last revised) — used
 * only as a fallback if the FY's `TaxDeductionRule` row (code "GRATUITY_EXEMPTION") isn't found. */
const FALLBACK_GRATUITY_CAP = 2000000;

export const gratuityService = {
  async calculate(input: CalculateGratuityInput) {
    if (input.employeeType === "GOVERNMENT") {
      return {
        employeeType: input.employeeType,
        gratuityReceived: input.gratuityReceived,
        exemptAmount: input.gratuityReceived,
        taxableAmount: 0,
        completedYears: null,
        divisor: null,
        formulaAmount: null,
        cap: null,
        formula: "Government employees: gratuity is fully exempt from tax under Section 10(10)(i).",
      };
    }

    const financialYearCode = input.financialYearCode ?? (await taxRulesService.getDefaultFinancialYearCode());
    const cap = await taxRulesService.getDeductionLimit(financialYearCode, "GRATUITY_EXEMPTION", FALLBACK_GRATUITY_CAP);

    // Employees covered under the Payment of Gratuity Act, 1972: 15/26 × last drawn salary ×
    // completed years of service (>=6 months rounded up to the next full year). Employees NOT
    // covered: 15/30 (half-month salary basis on a 30-day month) × years of service (exact
    // completed years only, no rounding of the part-year).
    const divisor = input.isCoveredUnderGratuityAct ? 26 : 30;
    const completedYears = input.isCoveredUnderGratuityAct
      ? Math.round(input.yearsOfService)
      : Math.floor(input.yearsOfService);
    const formulaAmount = (15 / divisor) * input.lastDrawnSalary * completedYears;

    const exemptAmount = Math.max(0, Math.min(input.gratuityReceived, formulaAmount, cap));
    const taxableAmount = Math.max(0, input.gratuityReceived - exemptAmount);

    return {
      employeeType: input.employeeType,
      gratuityReceived: input.gratuityReceived,
      exemptAmount,
      taxableAmount,
      completedYears,
      divisor,
      formulaAmount,
      cap,
      formula: `min(Gratuity received ₹${input.gratuityReceived.toLocaleString("en-IN")}, 15/${divisor} × ₹${input.lastDrawnSalary.toLocaleString(
        "en-IN"
      )} × ${completedYears} years = ₹${formulaAmount.toLocaleString("en-IN")}, statutory cap ₹${cap.toLocaleString(
        "en-IN"
      )}) = ₹${exemptAmount.toLocaleString("en-IN")}`,
    };
  },
};
