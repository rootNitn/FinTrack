export type CalculatorFieldType = 'currency' | 'percent' | 'years' | 'number' | 'select';

export interface CalculatorFieldOption {
  value: number;
  label: string;
}

export interface CalculatorField {
  key: string;
  label: string;
  type: CalculatorFieldType;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  options?: CalculatorFieldOption[];
}

export interface CalculatorSummaryItem {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface CalculatorBreakdownColumn {
  key: string;
  header: string;
}

export interface CalculatorChartSeries {
  name: string;
  data: number[];
}

export interface CalculatorChartPieSlice {
  name: string;
  value: number;
}

export interface CalculatorChartData {
  type: 'line' | 'bar' | 'pie';
  categories?: string[];
  series?: CalculatorChartSeries[];
  pieData?: CalculatorChartPieSlice[];
  stacked?: boolean;
}

export interface CalculatorResult {
  summary: CalculatorSummaryItem[];
  chart?: CalculatorChartData;
  breakdownTitle?: string;
  breakdownColumns?: CalculatorBreakdownColumn[];
  breakdownRows?: Record<string, string | number>[];
}

export interface CalculatorDefinition {
  slug: string;
  title: string;
  shortDescription: string;
  category: string;
  icon: string;
  fields: CalculatorField[];
  compute: (values: Record<string, number>) => CalculatorResult;
}
