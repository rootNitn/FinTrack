import { DocumentParser, ParseOutcome } from "./document-parser.interface";
import { findAmount, findAmountSum } from "./text-parsing.util";

export interface AisFields {
  salaryIncome: number;
  interestIncome: number;
  dividendIncome: number;
  capitalGainsIncome: number;
  propertyIncome: number;
  businessIncome: number;
  otherIncome: number;
  taxPaid: number;
  tdsAmount: number;
  tcsAmount: number;
  advanceTax: number;
}

/** Heuristic keyword/regex extraction for AIS (Annual Information Statement) PDFs/Excel exports. */
export class AisParser implements DocumentParser<AisFields> {
  parse(rawText: string): ParseOutcome<AisFields> {
    const warnings: string[] = [];

    const data: Partial<AisFields> = {
      salaryIncome: findAmount(rawText, ["salary", "income from salary"]),
      // AIS/TIS statements commonly list interest as several separate rows (savings bank
      // interest, deposit/FD interest, income tax refund interest) rather than one combined
      // total — sum each category independently instead of stopping at the first matching line,
      // otherwise e.g. "Interest from deposit" would be silently dropped whenever "Interest from
      // savings bank" appears earlier in the document.
      interestIncome: findAmountSum(rawText, [
        ["interest from savings", "interest on savings", "savings bank"],
        ["interest from deposit", "interest on deposit", "interest from fixed deposit", "term deposit"],
        ["interest on income tax refund", "income tax refund interest"],
      ]) ?? findAmount(rawText, ["interest income", "interest from deposit", "interest from savings"]),
      dividendIncome: findAmount(rawText, ["dividend"]),
      capitalGainsIncome: findAmount(rawText, ["capital gain"]),
      propertyIncome: findAmount(rawText, ["rent received", "income from house property", "property income"]),
      businessIncome: findAmount(rawText, ["business income", "receipt of business"]),
      otherIncome: findAmount(rawText, ["other income", "income from other sources"]),
      taxPaid: findAmount(rawText, ["total tax paid", "tax paid"]),
      tdsAmount: findAmount(rawText, ["tds", "tax deducted at source"]),
      tcsAmount: findAmount(rawText, ["tcs", "tax collected at source"]),
      advanceTax: findAmount(rawText, ["advance tax"]),
    };

    if (data.salaryIncome === undefined && data.interestIncome === undefined && data.capitalGainsIncome === undefined) {
      warnings.push("Could not detect most AIS income totals — please review and enter values manually.");
    }

    return { data, warnings };
  }
}
