export type CapitalGainAssetType = 'STOCK' | 'MUTUAL_FUND' | 'PROPERTY' | 'GOLD' | 'CRYPTO';
export type CapitalGainTermType = 'SHORT' | 'LONG';

export interface CapitalGainsTransactionInput {
  assetType: CapitalGainAssetType;
  purchaseDate: string;
  purchasePrice: number;
  saleDate: string;
  salePrice: number;
  quantity: number;
  brokerage: number;
  stampDuty: number;
  transferCharges: number;
}

export interface CapitalGainsTransactionResult extends CapitalGainsTransactionInput {
  id: string;
  holdingPeriodDays: number;
  termType: CapitalGainTermType;
  indexedCost: number | null;
  gainAmount: number;
  taxAmount: number;
}

export interface CapitalGainsSummary {
  totalStcg: number;
  totalLtcg: number;
  totalGain: number;
  totalTax: number;
  netProfit: number;
  byAssetType: Record<string, { gain: number; tax: number }>;
}

export interface CapitalGainsCalculationResult {
  transactions: CapitalGainsTransactionResult[];
  summary: CapitalGainsSummary;
}
