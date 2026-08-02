export interface StructuredTaxSavingSuggestion {
  code: string;
  title: string;
  description: string;
  investmentRequired: number;
  potentialTaxSaving: number;
  taxSaved: number;
  priorityScore: number;
}

export interface TaxSavingPlanResult {
  id: string;
  financialYearCode: string;
  suggestions: StructuredTaxSavingSuggestion[];
}
