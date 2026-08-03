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
}

export interface GoalFormValue {
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount?: number;
  deadline: string;
  icon?: string;
  familyMemberId?: string | null;
}
