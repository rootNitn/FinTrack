export type FinancialLevelName =
  | "FINANCIALLY_VULNERABLE"
  | "FINANCIALLY_STABLE"
  | "FINANCIALLY_SECURE"
  | "FINANCIALLY_STRONG"
  | "FINANCIALLY_INDEPENDENT"
  | "FINANCIALLY_WEALTHY";

export interface FinancialLevelDefinition {
  name: FinancialLevelName;
  label: string;
  minimumScore: number;
  requiredGateIds?: string[];
}

export const FINANCIAL_LEVELS: FinancialLevelDefinition[] = [
  { name: "FINANCIALLY_VULNERABLE", label: "Financially Vulnerable", minimumScore: 0 },
  { name: "FINANCIALLY_STABLE", label: "Financially Stable", minimumScore: 25 },
  { name: "FINANCIALLY_SECURE", label: "Financially Secure", minimumScore: 45 },
  { name: "FINANCIALLY_STRONG", label: "Financially Strong", minimumScore: 65 },
  {
    name: "FINANCIALLY_INDEPENDENT",
    label: "Financially Independent",
    minimumScore: 80,
    requiredGateIds: ["emergency-fund", "positive-cash-flow", "manageable-debt", "income-diversification", "goal-progress"],
  },
  {
    name: "FINANCIALLY_WEALTHY",
    label: "Financially Wealthy",
    minimumScore: 95,
    requiredGateIds: ["emergency-fund", "positive-cash-flow", "manageable-debt", "income-diversification", "goal-progress", "financial-independence", "passive-expense-coverage"],
  },
];

export interface LevelGate { id: string; label: string; passed: boolean; current: number | null; target: number; }

export function scoreLevel(score: number | null, gates: LevelGate[] = []): FinancialLevelDefinition {
  const safeScore = Math.max(0, Math.min(100, score ?? 0));
  let level = FINANCIAL_LEVELS[0];
  for (const candidate of FINANCIAL_LEVELS) {
    const requiredGateIds = candidate.requiredGateIds ?? [];
    const eligible = safeScore >= candidate.minimumScore && requiredGateIds.every((id) => gates.find((gate) => gate.id === id)?.passed === true);
    if (eligible) level = candidate;
  }
  return level;
}

export function safePercent(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : null;
}
