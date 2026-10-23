export type IncomeSourceMode = 'ACTIVE' | 'PASSIVE' | 'SEMI_PASSIVE';
export type IncomeSourceStability = 'LOW' | 'MEDIUM' | 'HIGH' | 'VARIABLE';
export type IncomeSourceGrowthPotential = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IncomeSourceProfile {
  id: string;
  name: string;
  type: string;
  incomeMode: IncomeSourceMode;
  monthlyAverageAmount: number;
  annualAmount: number | null;
  frequency: string;
  stability: IncomeSourceStability;
  growthPotential: IncomeSourceGrowthPotential;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
}

export interface IncomeSourceProfilePayload {
  name: string;
  type: string;
  incomeMode: IncomeSourceMode;
  monthlyAverageAmount: number;
  annualAmount?: number | null;
  frequency: string;
  stability: IncomeSourceStability;
  growthPotential: IncomeSourceGrowthPotential;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  notes?: string | null;
}
