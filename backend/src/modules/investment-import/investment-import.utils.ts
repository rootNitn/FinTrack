import { ImportRowResult, ParsedInvestmentRow } from "./types";

/** Builds the dedupe key per the app's duplicate rule: Name + Date + Units + Amount must all match. */
export function buildDuplicateKey(name: string, purchaseDate: string, units: number | null, amount: number | null): string {
  const normalizedName = name.trim().toLowerCase();
  const normalizedUnits = (units ?? 0).toFixed(4);
  const normalizedAmount = (amount ?? 0).toFixed(2);
  return `${normalizedName}|${purchaseDate}|${normalizedUnits}|${normalizedAmount}`;
}

/** Validates a single parsed row per the app's rules. Returns a list of human-readable issues (empty = valid). */
export function validateRow(row: ParsedInvestmentRow): string[] {
  const issues: string[] = [];

  if (!row.name || row.name.trim().length === 0) {
    issues.push("Missing name");
  }

  if (!row.purchaseDate) {
    issues.push("Invalid date");
  }

  if (row.amount === null || Number.isNaN(row.amount) || row.amount <= 0) {
    issues.push("Invalid amount");
  }

  if (row.units !== null && row.units < 0) {
    issues.push("Negative units");
  }

  return issues;
}

/** Marks each parsed row with validity + duplicate status against an existing set of dedupe keys. */
export function evaluateRows(rows: ParsedInvestmentRow[], existingKeys: ReadonlySet<string>): ImportRowResult[] {
  const seenInFile = new Set<string>();

  return rows.map((row) => {
    const issues = validateRow(row);
    const key = buildDuplicateKey(row.name, row.purchaseDate, row.units, row.amount);
    const isDuplicate = existingKeys.has(key) || seenInFile.has(key);
    if (!isDuplicate) seenInFile.add(key);

    return {
      ...row,
      isValid: issues.length === 0,
      issues,
      isDuplicate,
    };
  });
}
