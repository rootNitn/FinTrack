import { DocumentParser, ParseOutcome } from "./document-parser.interface";
import { findAmount, findMonth, findPan, findText } from "./text-parsing.util";

export interface SalarySlipFields {
  month: string;
  employeeName: string;
  employerName: string;
  pan: string;
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  conveyance: number;
  medicalAllowance: number;
  lta: number;
  bonus: number;
  commission: number;
  employerPf: number;
  employeePf: number;
  professionalTax: number;
  incomeTaxTds: number;
  grossSalary: number;
  netSalary: number;
  otherAllowances: number;
}

/** Heuristic keyword/regex extraction for Salary Slip PDFs/images/Excel sheets. */
export class SalarySlipParser implements DocumentParser<SalarySlipFields> {
  parse(rawText: string): ParseOutcome<SalarySlipFields> {
    const warnings: string[] = [];

    const data: Partial<SalarySlipFields> = {
      month: findMonth(rawText),
      employeeName: findText(rawText, ["employee name", "name of employee"]),
      employerName: findText(rawText, ["employer name", "company name", "organisation", "organization"]),
      pan: findPan(rawText),
      basicSalary: findAmount(rawText, ["basic salary", "basic pay", "basic"]),
      hra: findAmount(rawText, ["house rent allowance", "hra"]),
      specialAllowance: findAmount(rawText, ["special allowance"]),
      conveyance: findAmount(rawText, ["conveyance"]),
      medicalAllowance: findAmount(rawText, ["medical allowance", "medical reimbursement"]),
      lta: findAmount(rawText, ["leave travel allowance", "lta"]),
      bonus: findAmount(rawText, ["bonus"]),
      commission: findAmount(rawText, ["commission"]),
      employerPf: findAmount(rawText, ["employer pf", "employer's contribution to pf", "employer epf"]),
      employeePf: findAmount(rawText, ["employee pf", "pf deduction", "provident fund"]),
      professionalTax: findAmount(rawText, ["professional tax", "prof. tax", "p.tax"]),
      incomeTaxTds: findAmount(rawText, ["income tax", "tds", "tax deducted at source"]),
      grossSalary: findAmount(rawText, ["gross salary", "gross earnings", "total earnings"]),
      netSalary: findAmount(rawText, ["net salary", "net pay", "take home", "amount payable"]),
      otherAllowances: findAmount(rawText, ["other allowance", "other allowances"]),
    };

    if (data.grossSalary === undefined) warnings.push("Could not detect Gross Salary — please enter it manually.");
    if (data.netSalary === undefined) warnings.push("Could not detect Net Salary — please enter it manually.");
    if (data.basicSalary === undefined) warnings.push("Could not detect Basic Salary — please enter it manually.");

    return { data, warnings };
  }
}
