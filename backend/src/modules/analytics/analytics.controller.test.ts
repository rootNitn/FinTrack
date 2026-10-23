import { parseAnalyticsDateRange } from "./analytics.controller";

describe("parseAnalyticsDateRange", () => {
  test("includes the entire selected end date", () => {
    const range = parseAnalyticsDateRange("2026-10-15", "2026-10-15");

    expect(range.startDate?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(range.endDate?.toISOString()).toBe("2026-10-15T23:59:59.999Z");
  });

  test("rejects impossible calendar dates", () => {
    expect(() => parseAnalyticsDateRange("2026-02-30", undefined)).toThrow("Invalid analytics date range");
  });

  test("rejects reversed ranges", () => {
    expect(() => parseAnalyticsDateRange("2026-10-16", "2026-10-15")).toThrow("Start date must be before end date");
  });
});