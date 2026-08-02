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

/** Heuristic keyword/regex extraction for Form 26AS PDFs. */
export class Form26ASParser implements DocumentParser<Form26ASFields> {
  parse(rawText: string): ParseOutcome<Form26ASFields> {
    const warnings: string[] = [];

    const data: Partial<Form26ASFields> = {
      employerTds: findAmount(rawText, ["tds on salary", "part a", "deductor", "employer"]),
      bankTds: findAmount(rawText, ["tds on interest", "bank tds", "part a1"]),
      dividendTds: findAmount(rawText, ["tds on dividend", "dividend tds"]),
      propertyTds: findAmount(rawText, ["tds on sale of property", "194ia", "property tds"]),
      professionalIncomeTds: findAmount(rawText, ["tds on professional", "194j", "professional income tds"]),
      advanceTax: findAmount(rawText, ["advance tax"]),
      selfAssessmentTax: findAmount(rawText, ["self assessment tax", "self-assessment tax"]),
      refund: findAmount(rawText, ["refund"]),
      totalTaxPaid: findAmount(rawText, ["total tax paid", "total amount", "total"]),
    };

    if (data.totalTaxPaid === undefined) warnings.push("Could not detect Total Tax Paid — please enter it manually.");

    return { data, warnings };
  }
}
