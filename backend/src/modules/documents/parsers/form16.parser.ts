import { DocumentParser, ParseOutcome } from "./document-parser.interface";
import { findAmount, findLastMatch, findNear, findNextNonEmptyLine, findTan, findText, findYearCode } from "./text-parsing.util";

export interface Form16Fields {
  assessmentYear: string;
  employerName: string;
  employeeName: string;
  pan: string;
  tan: string;
  grossSalary: number;
  exemptions: number;
  deductions: number;
  professionalTax: number;
  standardDeduction: number;
  /** Section 80CCD(2) — employer's contribution to NPS, reported separately from Chapter VI-A. */
  employerNpsContribution: number;
  taxableIncome: number;
  tdsDeducted: number;
  taxDeposited: number;
}

const PAN_REGEX = /[A-Z]{5}[0-9]{4}[A-Z]/;
const TAN_REGEX = /[A-Z]{4}[0-9]{5}[A-Z]/;

/**
 * The standard TRACES Form 16 Part A quarterly summary table ends with a "Total (Rs.)" row
 * holding exactly 3 currency figures: amount paid/credited, amount of tax deducted, amount of
 * tax deposited — e.g. "Total (Rs.) 1809613.38 131589.00 131589.00". This is a more reliable
 * source for gross salary / TDS deducted / tax deposited than Part B's numbered, cross-
 * referenced line items, which are prone to same-line keyword mismatches. Only matches when 3
 * decimal-formatted amounts are present, so it doesn't collide with the (single-value) challan
 * "Total (Rs.)" row that appears later in the document.
 */
function extractPartASummaryRow(
  text: string,
): { paidCredited: number; taxDeducted: number; taxDeposited: number } | undefined {
  const rowPattern = /total\s*\(rs\.?\)\D*([\d,]+\.\d{2})\D+([\d,]+\.\d{2})\D+([\d,]+\.\d{2})/i;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(rowPattern);
    if (match) {
      return {
        paidCredited: Number(match[1].replace(/,/g, "")),
        taxDeducted: Number(match[2].replace(/,/g, "")),
        taxDeposited: Number(match[3].replace(/,/g, "")),
      };
    }
  }
  return undefined;
}

/** Heuristic keyword/regex extraction for Form 16 PDFs. */
export class Form16Parser implements DocumentParser<Form16Fields> {
  parse(rawText: string): ParseOutcome<Form16Fields> {
    const warnings: string[] = [];
    const partATotals = extractPartASummaryRow(rawText);

    const data: Partial<Form16Fields> = {
      assessmentYear: findYearCode(rawText),
      employerName:
        findNextNonEmptyLine(rawText, ["name and address of the employer"]) ??
        findText(rawText, ["name and address of the employer", "employer name"]),
      employeeName:
        findNextNonEmptyLine(rawText, ["name and address of the employee"]) ??
        findText(rawText, ["name and address of the employee", "employee name"]),
      // Form 16 Part A always lists the deductor/employer's PAN before the employee's PAN, in
      // a fixed column order (PAN of Deductor, TAN of Deductor, PAN of Employee) — so the
      // employee's PAN is reliably the LAST PAN-shaped token in the document, regardless of
      // exactly how the table cells get flattened into lines by the PDF text extractor.
      pan: findLastMatch(rawText, PAN_REGEX),
      tan: findNear(rawText, "tan of the deductor", TAN_REGEX) ?? findTan(rawText),
      grossSalary:
        findAmount(rawText, [
          "gross salary",
          "salary as per section 17",
          "total amount of salary received from current employer",
        ]) ?? partATotals?.paidCredited,
      exemptions: findAmount(rawText, [
        "exempt allowance",
        "exemption under section 10",
        "allowances exempt",
        "total amount of exemption claimed under section 10",
      ]),
      deductions: findAmount(rawText, [
        "total deduction under chapter vi-a",
        "deduction under chapter vi",
        "aggregate of deductible amount under chapter vi-a",
      ]),
      professionalTax: findAmount(rawText, ["tax on employment", "professional tax"]),
      standardDeduction: findAmount(rawText, ["standard deduction"]),
      employerNpsContribution: findAmount(rawText, [
        "80ccd(2)",
        "80ccd (2)",
        "80 ccd(2)",
        "80 ccd (2)",
        "contribution by employer to pension scheme",
        "employer's contribution to pension scheme",
        "employer contribution to pension scheme",
        "employer's contribution to nps",
        "employer contribution to nps",
      ]),
      taxableIncome: findAmount(rawText, ["total taxable income", "taxable income"]),
      tdsDeducted:
        findAmount(rawText, ["total tax deducted", "amount of tax deducted"]) ?? partATotals?.taxDeducted,
      taxDeposited:
        findAmount(rawText, ["total tax deposited", "amount of tax deposited", "tax deposited"]) ??
        partATotals?.taxDeposited,
    };

    if (data.grossSalary === undefined) warnings.push("Could not detect Gross Salary — please enter it manually.");
    if (data.taxableIncome === undefined) warnings.push("Could not detect Taxable Income — please enter it manually.");
    if (data.tdsDeducted === undefined) warnings.push("Could not detect TDS Deducted — please enter it manually.");

    return { data, warnings };
  }
}

