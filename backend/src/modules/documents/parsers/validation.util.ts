import { prisma } from "../../../config/prisma";
import { TaxDocumentType } from "@prisma/client";

export interface FieldCheck {
  condition: string;
  fieldName: string;
  actual: number | undefined;
  expected: number | undefined;
  defaultMessage: string;
}

/**
 * Runs a set of "actual vs expected" numeric checks for a document import, using the
 * admin-managed `TaxValidationRule` table for the tolerance/message when a matching active rule
 * exists (by documentType + condition), falling back to a ₹1 tolerance and the caller-supplied
 * default message otherwise. Never throws — returns warning strings only (imports never hard-fail
 * on validation mismatches, per spec).
 */
export async function runValidationChecks(documentType: TaxDocumentType, checks: FieldCheck[]): Promise<string[]> {
  const warnings: string[] = [];

  const rules = await prisma.taxValidationRule.findMany({
    where: { documentType, isActive: true },
  });
  const ruleByCondition = new Map(rules.map((r) => [r.condition, r]));

  for (const check of checks) {
    if (check.actual === undefined || check.expected === undefined) continue;
    const rule = ruleByCondition.get(check.condition);
    const tolerance = rule ? Number(rule.tolerance) : 1;
    const diff = Math.abs(check.actual - check.expected);
    if (diff > tolerance) {
      warnings.push(rule?.message ?? check.defaultMessage);
    }
  }

  return warnings;
}
