import { DocumentParser, ParseOutcome } from "./document-parser.interface";
import { findAmount } from "./text-parsing.util";

export interface Form26ASFields {
  employerTds: number;
  bankTds: number;
  dividendTds: number;
  propertyTds: number;
  professionalIncomeTds: number;
  advanceTax: number;
  selfAssessmentTax: number;
  refund: number;
  totalTaxPaid: number;
}

function findFirstAmount(text: string, labelGroups: string[][]): number | undefined {
  for (const labels of labelGroups) {
    const value = findAmount(text, labels);
    if (value !== undefined) return value;
  }
  return undefined;
}

function extractPartATotal(text: string): { taxDeducted: number; taxDeposited: number } | undefined {
  const amountPattern = /(?:₹|rs\.?)?\s*-?[\d,]+(?:\.\d{1,2})?/gi;
  for (const line of text.split(/\r?\n/)) {
    if (!/total/i.test(line) || !/(paid|credited|tax|rs\.?)/i.test(line)) continue;
    const amounts = line.match(amountPattern)?.map((token) => Number(token.replace(/[₹,]/gi, "").replace(/rs\.?/i, ""))) ?? [];
    if (amounts.length >= 3 && amounts.every(Number.isFinite)) {
      return { taxDeducted: amounts[amounts.length - 2], taxDeposited: amounts[amounts.length - 1] };
    }
  }
  return undefined;
}

/** Heuristic keyword/regex extraction for Form 26AS PDFs. */
export class Form26ASParser implements DocumentParser<Form26ASFields> {
  parse(rawText: string): ParseOutcome<Form26ASFields> {
    const warnings: string[] = [];
    const partATotal = extractPartATotal(rawText);

    if (/annual information statement|part b1-information relating to tax deducted/i.test(rawText)) {
      warnings.push("This appears to be an AIS statement, not Form 26AS. Upload it in the AIS tab to import salary, interest and TDS values.");
    }

    const data: Partial<Form26ASFields> = {
      employerTds: findFirstAmount(rawText, [["tds on salary"], ["salary tds"], ["employer tds"]]) ?? partATotal?.taxDeducted,
      bankTds: findFirstAmount(rawText, [["tds on interest"], ["bank tds"], ["interest tds"]]),
      dividendTds: findAmount(rawText, ["tds on dividend", "dividend tds"]),
      propertyTds: findAmount(rawText, ["tds on sale of property", "194ia", "property tds"]),
      professionalIncomeTds: findAmount(rawText, ["tds on professional", "194j", "professional income tds"]),
      advanceTax: findAmount(rawText, ["advance tax paid", "advance tax"]),
      selfAssessmentTax: findAmount(rawText, ["self assessment tax paid", "self assessment tax", "self-assessment tax"]),
      refund: findAmount(rawText, ["total refund", "refund amount", "refund"]),
      totalTaxPaid: findFirstAmount(rawText, [
        ["total tax paid"],
        ["total taxes paid"],
        ["total amount of tax paid"],
      ]) ?? partATotal?.taxDeposited,
    };

    if (data.totalTaxPaid === undefined) warnings.push("Could not detect Total Tax Paid — please enter it manually.");

    return { data, warnings };
  }
}
