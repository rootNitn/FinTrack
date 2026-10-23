import { healthConnectionSchema, healthSourcePreferenceSchema, healthSyncSchema, healthLocalDate, healthDailySchema } from "./health-connect.dto";

describe("Health Connect contract", () => {
  const connection = { deviceName: "Phone", timezone: "Asia/Kolkata", enabledMetrics: ["STEPS"], grantedMetrics: [], backgroundReadAvailable: true, backgroundReadGranted: false, consent: true };
  const batch = { connectionId: "00000000-0000-4000-8000-000000000001", generation: 0, batchId: "00000000-0000-4000-8000-000000000002", syncStartedAt: "2026-10-05T00:00:00Z", completed: true, records: [], deletions: [], daily: [] };
  test("accepts partial permission and empty sync", () => {
    expect(healthConnectionSchema.safeParse(connection).success).toBe(true);
    expect(healthSyncSchema.safeParse(batch).success).toBe(true);
  });
  test("rejects client ownership and invalid timezone", () => {
    expect(healthSyncSchema.safeParse({ ...batch, userId: "another-user" }).success).toBe(false);
    expect(healthConnectionSchema.safeParse({ ...connection, timezone: "invalid" }).success).toBe(false);
  });
  test("rejects invalid dates, numbers and mismatched units", () => {
    expect(healthDailySchema.safeParse({ date: "2026-02-30", steps: 1 }).success).toBe(false);
    expect(healthDailySchema.safeParse({ date: "2026-10-05", steps: -1 }).success).toBe(false);
    const record = { sourceRecordId: "1", source: "app", metricType: "WEIGHT", unit: "count", value: 70, startTime: batch.syncStartedAt, endTime: batch.syncStartedAt, modifiedAt: batch.syncStartedAt };
    expect(healthSyncSchema.safeParse({ ...batch, records: [record] }).success).toBe(false);
  });
  test("accepts bounded raw sleep stages and heart-rate samples", () => {
    const record = {
      sourceRecordId: "heart-1", source: "health.app", metricType: "HEART_RATE", unit: "bpm", value: 72,
      startTime: batch.syncStartedAt, endTime: batch.syncStartedAt, modifiedAt: batch.syncStartedAt,
      rawData: { samples: [{ time: batch.syncStartedAt, beatsPerMinute: 72 }] },
    };
    expect(healthSyncSchema.safeParse({ ...batch, records: [record] }).success).toBe(true);
    expect(healthSyncSchema.safeParse({ ...batch, records: [{ ...record, rawData: { samples: Array(2001).fill({ time: batch.syncStartedAt, beatsPerMinute: 72 }) } }] }).success).toBe(false);
  });
  test("accepts only supported per-metric source preferences", () => {
    expect(healthSourcePreferenceSchema.safeParse({ primarySources: { STEPS: "com.example.steps" } }).success).toBe(true);
    expect(healthSourcePreferenceSchema.safeParse({ primarySources: { UNKNOWN: "com.example.app" } }).success).toBe(false);
  });
  test("uses local reporting day including DST", () => {
    expect(healthLocalDate(new Date("2026-10-04T20:00:00Z"), "Asia/Kolkata")).toBe("2026-10-05");
    expect(healthLocalDate(new Date("2026-03-08T07:00:00Z"), "America/New_York")).toBe("2026-03-08");
  });
});