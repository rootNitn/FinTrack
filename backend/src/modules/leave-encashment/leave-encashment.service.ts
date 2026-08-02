import { taxRulesService } from "../tax/tax-rules.service";
import { CalculateLeaveEncashmentInput } from "./leave-encashment.dto";

/** Statutory leave-encashment exemption cap (revised May 2023) — fallback if the FY's
 * `TaxDeductionRule` row (code "LEAVE_ENCASHMENT_EXEMPTION") isn't found. */
const FALLBACK_LEAVE_ENCASHMENT_CAP = 2500000;
/** Unutilized leave accrual is capped at 30 days per completed year of service. */
const MAX_LEAVE_DAYS_PER_YEAR = 30;
const DAYS_PER_MONTH = 30;

export const leaveEncashmentService = {
  async calculate(input: CalculateLeaveEncashmentInput) {
    if (input.employeeType === "GOVERNMENT") {
      return {
        employeeType: input.employeeType,
        leaveEncashmentReceived: input.leaveEncashmentReceived,
        exemptAmount: input.leaveEncashmentReceived,
        taxableAmount: 0,
        cap: null,
        tenMonthsAvgSalary: null,
        cashEquivalentOfEligibleLeave: null,
        formula: "Government employees: leave encashment on retirement/superannuation is fully exempt under Section 10(10AA)(i).",
      };
    }

    const financialYearCode = input.financialYearCode ?? (await taxRulesService.getDefaultFinancialYearCode());
    const cap = await taxRulesService.getDeductionLimit(
      financialYearCode,
      "LEAVE_ENCASHMENT_EXEMPTION",
      FALLBACK_LEAVE_ENCASHMENT_CAP
    );

    // Section 10(10AA)(ii) "least of 4" exemption for non-government employees.
    const avgDailySalary = input.avgMonthlySalaryLast10Months / DAYS_PER_MONTH;
    const maxEligibleLeaveDays = Math.min(input.leaveDaysEncashed, input.yearsOfService * MAX_LEAVE_DAYS_PER_YEAR);
    const cashEquivalentOfEligibleLeave = maxEligibleLeaveDays * avgDailySalary;
    const tenMonthsAvgSalary = input.avgMonthlySalaryLast10Months * 10;

    const exemptAmount = Math.max(
      0,
      Math.min(input.leaveEncashmentReceived, cap, tenMonthsAvgSalary, cashEquivalentOfEligibleLeave)
    );
    const taxableAmount = Math.max(0, input.leaveEncashmentReceived - exemptAmount);

    return {
      employeeType: input.employeeType,
      leaveEncashmentReceived: input.leaveEncashmentReceived,
      exemptAmount,
      taxableAmount,
      cap,
      tenMonthsAvgSalary,
      cashEquivalentOfEligibleLeave,
      formula: `min(Leave encashment received ₹${input.leaveEncashmentReceived.toLocaleString(
        "en-IN"
      )}, statutory cap ₹${cap.toLocaleString("en-IN")}, 10 months' avg salary ₹${tenMonthsAvgSalary.toLocaleString(
        "en-IN"
      )}, cash equivalent of eligible leave ₹${cashEquivalentOfEligibleLeave.toLocaleString(
        "en-IN"
      )}) = ₹${exemptAmount.toLocaleString("en-IN")}`,
    };
  },
};
