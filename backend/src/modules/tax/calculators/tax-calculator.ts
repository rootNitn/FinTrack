import { TaxRegimeType } from "@prisma/client";
import { OldRegimeCalculator } from "./old-regime.calculator";
import { NewRegimeCalculator } from "./new-regime.calculator";
import { RegimeResult, RegimeRuleSet, TaxCalculationInput, TaxCalculator as ITaxCalculator } from "./tax-calculator.types";

/**
 * `TaxCalculator` — the Strategy pattern context explicitly required by the spec. It holds no
 * tax logic itself; it simply delegates to whichever concrete strategy (`OldRegimeCalculator` /
 * `NewRegimeCalculator`) matches the requested regime. Adding a future regime variant (e.g. a
 * hypothetical "Regime 3") only requires a new class implementing `TaxCalculator` (the interface)
 * and one extra case in `forRegime` — no other code changes.
 */
export class TaxCalculator {
  private static readonly strategies: Record<TaxRegimeType, ITaxCalculator> = {
    OLD: new OldRegimeCalculator(),
    NEW: new NewRegimeCalculator(),
  };

  static forRegime(regime: TaxRegimeType): ITaxCalculator {
    return TaxCalculator.strategies[regime];
  }

  static calculate(regime: TaxRegimeType, input: TaxCalculationInput, rules: RegimeRuleSet): RegimeResult {
    return TaxCalculator.forRegime(regime).calculate(input, rules);
  }
}
