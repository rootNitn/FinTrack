export interface HraCalculationResult {
  isMetro: boolean;
  hraReceived: number;
  rentMinusTenPercentOfBasic: number;
  percentOfBasicLimit: number;
  percentOfBasicUsed: number;
  exemptAmount: number;
  taxableAmount: number;
  formula: string;
}

export interface GratuityCalculationResult {
  employeeType: 'GOVERNMENT' | 'NON_GOVERNMENT';
  gratuityReceived: number;
  exemptAmount: number;
  taxableAmount: number;
  completedYears: number | null;
  divisor: number | null;
  formulaAmount: number | null;
  cap: number | null;
  formula: string;
}

export interface LeaveEncashmentCalculationResult {
  employeeType: 'GOVERNMENT' | 'NON_GOVERNMENT';
  leaveEncashmentReceived: number;
  exemptAmount: number;
  taxableAmount: number;
  cap: number | null;
  tenMonthsAvgSalary: number | null;
  cashEquivalentOfEligibleLeave: number | null;
  formula: string;
}
