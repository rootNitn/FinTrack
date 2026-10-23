import { z } from "zod";

export const healthConnectMetrics = ["STEPS", "SLEEP", "EXERCISE", "WEIGHT", "HEART_RATE"] as const;
const metric = z.enum(healthConnectMetrics);
const instant = z.string().datetime({ offset: true });
const identifier = z.string().min(1).max(200);
export const healthConnectionSchema = z.object({
  deviceName: z.string().trim().min(1).max(100),
  timezone: z.string().max(100).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Invalid timezone"),
  enabledMetrics: z.array(metric).min(1).max(5),
  grantedMetrics: z.array(metric).max(5),
  backgroundReadGranted: z.boolean(),
  backgroundReadAvailable: z.boolean(),
  consent: z.literal(true),
}).strict();
export const healthPermissionSchema = healthConnectionSchema.omit({ deviceName: true, consent: true });
export const healthSourcePreferenceSchema = z.object({
  primarySources: z.object({
    STEPS: z.string().min(1).max(200).nullable().optional(),
    SLEEP: z.string().min(1).max(200).nullable().optional(),
    EXERCISE: z.string().min(1).max(200).nullable().optional(),
    WEIGHT: z.string().min(1).max(200).nullable().optional(),
    HEART_RATE: z.string().min(1).max(200).nullable().optional(),
  }).strict(),
}).strict();
const importedRecord = z.object({
  sourceRecordId: identifier,
  metricType: metric,
  source: z.string().min(1).max(200),
  startTime: instant,
  endTime: instant,
  modifiedAt: instant,
  value: z.number().finite().nonnegative().max(1e9),
  unit: z.enum(["count", "minutes", "kg", "bpm"]),
  rawData: z.object({
    samples: z.array(z.object({ time: instant, beatsPerMinute: z.number().positive().max(500) }).strict()).max(2000).optional(),
    stages: z.array(z.object({ stage: z.enum(["AWAKE", "SLEEPING", "OUT_OF_BED", "LIGHT", "DEEP", "REM", "UNKNOWN"]), startTime: instant, endTime: instant }).strict()).max(200).optional(),
    exerciseType: z.string().max(100).optional(),
    startZoneOffset: z.string().max(20).optional(),
    endZoneOffset: z.string().max(20).optional(),
  }).strict().optional(),
}).strict().superRefine((record, context) => {
  const units = { STEPS: "count", SLEEP: "minutes", EXERCISE: "minutes", WEIGHT: "kg", HEART_RATE: "bpm" };
  if (units[record.metricType] !== record.unit || Date.parse(record.endTime) < Date.parse(record.startTime)) {
    context.addIssue({ code: "custom", message: "Invalid metric unit or time interval" });
  }
});
export const healthDailySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
  steps: z.number().int().nonnegative().max(1000000).nullable().optional(),
  sleepMinutes: z.number().nonnegative().max(1440).nullable().optional(),
  exerciseMinutes: z.number().nonnegative().max(1440).nullable().optional(),
  weightKg: z.number().positive().max(1000).nullable().optional(),
  averageHeartRate: z.number().positive().max(500).nullable().optional(),
}).strict();
export const healthSyncSchema = z.object({
  connectionId: z.string().uuid(),
  generation: z.number().int().nonnegative(),
  batchId: z.string().uuid(),
  syncStartedAt: instant,
  completed: z.boolean(),
  records: z.array(importedRecord).max(500),
  deletions: z.array(z.object({ sourceRecordId: identifier, metricType: metric }).strict()).max(500),
  daily: z.array(healthDailySchema).max(32),
  reconciliation: z.object({
    metricType: metric,
    from: instant,
    to: instant,
    sourceRecordIds: z.array(identifier).max(50000),
  }).strict().refine(scope => Date.parse(scope.to) > Date.parse(scope.from), "Invalid reconciliation interval").optional(),
}).strict();
export const healthSyncStatusSchema = z.object({
  status: z.enum(["SYNCING", "RETRYING", "PERMISSION_REQUIRED", "SIGN_IN_REQUIRED", "RECOVERY_REQUIRED"]),
  errorCode: z.enum(["NETWORK", "SERVER", "PERMISSION", "BACKGROUND_UNAVAILABLE", "AUTH", "TOKEN_EXPIRED", "HISTORY_LIMIT"]).nullable(),
}).strict();
export type HealthSyncInput = z.infer<typeof healthSyncSchema>;

export function healthLocalDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}