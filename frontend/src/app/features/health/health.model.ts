export type VitalType = 'BLOOD_PRESSURE' | 'BLOOD_SUGAR' | 'HEART_RATE';
export type WorkoutType = 'CARDIO' | 'STRENGTH' | 'YOGA' | 'SPORTS' | 'WALKING' | 'OTHER';
export type MedicationLogStatus = 'TAKEN' | 'MISSED' | 'SKIPPED';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type HealthGoalType = 'WEIGHT_TARGET' | 'STEPS_DAILY' | 'WATER_DAILY' | 'SLEEP_DAILY' | 'WORKOUT_WEEKLY';

export const VITAL_TYPES: VitalType[] = ['BLOOD_PRESSURE', 'BLOOD_SUGAR', 'HEART_RATE'];
export const WORKOUT_TYPES: WorkoutType[] = ['CARDIO', 'STRENGTH', 'YOGA', 'SPORTS', 'WALKING', 'OTHER'];
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];
export const DOCTOR_SPECIALTIES: string[] = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'ENT Specialist',
  'Endocrinologist',
  'Gastroenterologist',
  'Gynecologist',
  'Nephrologist',
  'Neurologist',
  'Oncologist',
  'Ophthalmologist',
  'Orthopedic',
  'Pediatrician',
  'Psychiatrist',
  'Pulmonologist',
  'Radiologist',
  'Urologist',
  'Dentist',
  'Other',
];
export const HEALTH_GOAL_TYPES: HealthGoalType[] = [
  'WEIGHT_TARGET',
  'STEPS_DAILY',
  'WATER_DAILY',
  'SLEEP_DAILY',
  'WORKOUT_WEEKLY',
];

export interface BodyMetricLog {
  id: string;
  userId: string;
  weightKg: number;
  heightCm?: number | null;
  bmi?: number | null;
  bodyFatPercent?: number | null;
  waistCm?: number | null;
  notes?: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface BodyMetricFormValue {
  weightKg: number;
  heightCm?: number;
  bodyFatPercent?: number;
  waistCm?: number;
  notes?: string;
  recordedAt?: string;
}

export interface VitalLog {
  id: string;
  userId: string;
  type: VitalType;
  systolic?: number | null;
  diastolic?: number | null;
  value?: number | null;
  unit?: string | null;
  context?: string | null;
  notes?: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface VitalFormValue {
  type: VitalType;
  systolic?: number;
  diastolic?: number;
  value?: number;
  unit?: string;
  context?: string;
  notes?: string;
  recordedAt?: string;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  type: WorkoutType;
  name?: string | null;
  durationMinutes: number;
  caloriesBurned?: number | null;
  distanceKm?: number | null;
  notes?: string | null;
  date: string;
  createdAt: string;
}

export interface WorkoutFormValue {
  type: WorkoutType;
  name?: string;
  durationMinutes: number;
  caloriesBurned?: number;
  distanceKm?: number;
  notes?: string;
  date?: string;
}

export interface DailyWellnessLog {
  id: string;
  userId: string;
  date: string;
  waterIntakeMl?: number | null;
  sleepHours?: number | null;
  steps?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyWellnessFormValue {
  waterIntakeMl?: number;
  sleepHours?: number;
  steps?: number;
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage?: string | null;
  scheduleTimes: string[];
  startDate: string;
  endDate?: string | null;
  active: boolean;
  reminderEnabled: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationFormValue {
  name: string;
  dosage?: string;
  scheduleTimes: string[];
  startDate: string;
  endDate?: string | null;
  active?: boolean;
  reminderEnabled?: boolean;
  notes?: string;
}

export interface MedicationLog {
  id: string;
  userId: string;
  medicationId: string;
  status: MedicationLogStatus;
  scheduledFor: string;
  takenAt?: string | null;
  createdAt: string;
}

export interface DoctorAppointment {
  id: string;
  userId: string;
  doctorName: string;
  specialty?: string | null;
  appointmentDate: string;
  location?: string | null;
  notes?: string | null;
  status: AppointmentStatus;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentFormValue {
  doctorName: string;
  specialty?: string;
  appointmentDate: string;
  location?: string;
  notes?: string;
  status?: AppointmentStatus;
  reminderEnabled?: boolean;
}

export interface HealthGoal {
  id: string;
  userId: string;
  type: HealthGoalType;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
  deadline?: string | null;
  achievedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthGoalFormValue {
  type: HealthGoalType;
  targetValue: number;
  deadline?: string | null;
}

export interface HealthSummary {
  latestWeight: BodyMetricLog | null;
  weightTrend: BodyMetricLog[];
  today: DailyWellnessLog | null;
  vitalsTrend: Record<VitalType, VitalLog[]>;
  activeMedications: Medication[];
  upcomingAppointments: DoctorAppointment[];
  goals: HealthGoal[];
  medicationCount: number;
}

export type HealthReportStatus = 'UPLOADED' | 'PARSED' | 'FAILED' | 'PASSWORD_REQUIRED';
export type HealthResultFlag = 'LOW' | 'NORMAL' | 'HIGH' | 'UNKNOWN';

export interface HealthReportResult {
  id: string;
  reportId: string;
  userId: string;
  testName: string;
  value: number;
  unit?: string | null;
  referenceLow?: number | null;
  referenceHigh?: number | null;
  flag: HealthResultFlag;
  createdAt: string;
  updatedAt: string;
}

export interface HealthReportResultFormValue {
  testName: string;
  value: number;
  unit?: string;
  referenceLow?: number;
  referenceHigh?: number;
}

export interface HealthReportDocument {
  id: string;
  userId: string;
  fileName: string;
  reportDate: string;
  testDate?: string | null;
  labName?: string | null;
  patientName?: string | null;
  patientAge?: string | null;
  patientGender?: string | null;
  status: HealthReportStatus;
  parseErrors?: unknown;
  createdAt: string;
  updatedAt: string;
  results?: HealthReportResult[];
  resultCount?: number;
  abnormalCount?: number;
}

export interface HealthReportComparisonEntry extends HealthReportResult {
  reportDate: string;
  labName?: string | null;
  fileName: string;
}

export interface HealthReportComparison {
  testName: string;
  history: HealthReportComparisonEntry[];
  latest: HealthReportComparisonEntry | null;
  previous: HealthReportComparisonEntry | null;
  delta: number | null;
}

export type HealthCategory = 'DIET' | 'EXERCISE' | 'SLEEP' | 'STRESS' | 'HYDRATION' | 'NUTRITION';
export type HealthPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type FocusArea = 'DIET' | 'WORKOUT' | 'SLEEP' | 'STRESS' | 'OVERALL';

export interface HealthImprovement {
  title: string;
  category: HealthCategory;
  priority: HealthPriority;
  currentSituation: string;
  recommendation: string;
  expectedBenefit: string;
}

export interface DailyScheduleItem {
  time: string;
  activity: string;
  duration: string;
  notes?: string;
}

export interface MealPlanItem {
  meal: string;
  items: string[];
  hydration?: string;
}

export interface HealthAiImproveResponse {
  overallWellnessScore: number;
  summary: string;
  keyFindings: string[];
  improvements: HealthImprovement[];
  dailySchedule: DailyScheduleItem[];
  mealPlan: MealPlanItem[];
  weeklyGoals: string[];
  finalRecommendation: string;
}

export interface HealthAiImproveRequest {
  reportId?: string;
  focusArea?: FocusArea;
}

export interface HealthWellnessPlan {
  id: string;
  userId: string;
  reportId: string | null;
  focusArea: FocusArea | null;
  content: HealthAiImproveResponse;
  createdAt: string;
  updatedAt: string;
}

export interface SaveHealthWellnessPlanRequest {
  reportId?: string;
  focusArea?: FocusArea;
  content: HealthAiImproveResponse;
}
