export interface MarketRate {
  symbol: string;
  label: string;
  unit: string;
  price: number;
  changeAmount: number;
  changePercent: number;
  asOf: string;
}
