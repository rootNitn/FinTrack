export type GoalType =
  | 'EMERGENCY_FUND'
  | 'HOUSE'
  | 'CAR'
  | 'VACATION'
  | 'RETIREMENT'
  | 'CHILD_EDUCATION'
  | 'CUSTOM';

export const GOAL_TYPES: GoalType[] = [
  'EMERGENCY_FUND',
  'HOUSE',
  'CAR',
  'VACATION',
  'RETIREMENT',
  'CHILD_EDUCATION',
  'CUSTOM',
];

export interface Goal {
  id: string;
  userId: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  icon?: string | null;
  progressPercent: number;
  remainingAmount: number;
  familyMemberId?: string | null;
  familyMemberName?: string | null;
  createdAt: string;
  updatedAt: string;
  projectedCompletionDate?: string | null;
  requiredMonthlyContribution?: number | null;
  expectedReturnPercent?: number | null;
  status?: 'ACHIEVED' | 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'OVERDUE' | null;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  userId: string;
  amount: number;
  date: string;
  note?: string | null;
  createdAt: string;
}

export interface GoalFormValue {
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount?: number;
  deadline: string;
  icon?: string;
  expectedReturnPercent?: number | null;
  familyMemberId?: string | null;
}
