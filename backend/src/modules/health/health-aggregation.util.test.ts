import { aggregateHealthDay, healthLocalDayBounds } from "./health-aggregation.util";

const date = "2026-10-14";
const timezone = "Asia/Kolkata";

function record(overrides: Record<string, unknown> = {}) {
  return {
    metricType: "STEPS" as const,
    source: "primary.app",
    value: 1000,
    startTime: "2026-10-13T18:30:00.000Z",
    endTime: "2026-10-13T18:40:00.000Z",
    modifiedAt: "2026-10-13T18:40:00.000Z",
    ...overrides,
  };
}

describe("canonical Health Connect aggregation", () => {
  test("manual daily entries override imported values without summing them", () => {
    const result = aggregateHealthDay({
      date,
      timezone,
      records: [record()],
      primarySources: { STEPS: "primary.app" },
      manual: { steps: 400 },
    });

    expect(result.steps).toBe(400);
    expect(result.provenance.STEPS).toMatchObject({ source: "MANUAL", recordCount: 1 });
  });

  test("only the selected primary source contributes to totals", () => {
    const result = aggregateHealthDay({
      date,
      timezone,
      records: [record(), record({ source: "overlapping.app", value: 900 })],
      primarySources: { STEPS: "primary.app" },
      manual: {},
    });

    expect(result.steps).toBe(1000);
    expect(result.provenance.STEPS).toMatchObject({ source: "HEALTH_CONNECT", primarySource: "primary.app", recordCount: 1 });
  });

  test("step intervals crossing local midnight are apportioned by elapsed duration", () => {
    const result = aggregateHealthDay({
      date,
      timezone,
      records: [record({
        value: 120,
        startTime: "2026-10-13T18:20:00.000Z",
        endTime: "2026-10-13T18:40:00.000Z",
      })],
      primarySources: { STEPS: "primary.app" },
      manual: {},
    });

    expect(result.steps).toBe(60);
  });

  test("local day bounds follow daylight-saving transitions", () => {
    const bounds = healthLocalDayBounds("2026-03-08", "America/New_York");
    expect(bounds.end.getTime() - bounds.start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  test("sleep stages exclude awake time, merge overlaps and attribute the session to its wake day", () => {
    const result = aggregateHealthDay({
      date,
      timezone,
      records: [record({
        metricType: "SLEEP",
        value: 480,
        startTime: "2026-10-13T17:00:00.000Z",
        endTime: "2026-10-14T01:00:00.000Z",
        rawData: { stages: [
          { stage: "DEEP", startTime: "2026-10-13T18:00:00.000Z", endTime: "2026-10-13T19:00:00.000Z" },
          { stage: "AWAKE", startTime: "2026-10-13T19:00:00.000Z", endTime: "2026-10-13T19:15:00.000Z" },
          { stage: "REM", startTime: "2026-10-13T19:10:00.000Z", endTime: "2026-10-13T20:00:00.000Z" },
        ] },
      })],
      primarySources: { SLEEP: "primary.app" },
      manual: {},
    });

    expect(result.sleepMinutes).toBe(110);
  });

  test("heart-rate averages use raw local-day samples, not the collapsed record average", () => {
    const result = aggregateHealthDay({
      date,
      timezone,
      records: [record({
        metricType: "HEART_RATE",
        value: 99,
        rawData: { samples: [
          { time: "2026-10-13T18:30:00.000Z", beatsPerMinute: 60 },
          { time: "2026-10-13T18:31:00.000Z", beatsPerMinute: 80 },
          { time: "2026-10-13T18:32:00.000Z", beatsPerMinute: 100 },
        ] },
      })],
      primarySources: { HEART_RATE: "primary.app" },
      manual: {},
    });

    expect(result.averageHeartRate).toBe(80);
  });
});