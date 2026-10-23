import { dayKey, firstUtcDayOfMonth, lastUtcMillisecondOfMonth, monthKey, monthsAgo } from "./analytics-date.util";

describe("analytics UTC date buckets", () => {
  test("groups instants by their UTC month and day", () => {
    const date = new Date("2026-03-01T00:30:00.000Z");
    expect(monthKey(date)).toBe("2026-03");
    expect(dayKey(date)).toBe("2026-03-01");
  });

  test("builds exact UTC month boundaries including leap days", () => {
    expect(firstUtcDayOfMonth(2028, 2).toISOString()).toBe("2028-02-01T00:00:00.000Z");
    expect(lastUtcMillisecondOfMonth(2028, 2).toISOString()).toBe("2028-02-29T23:59:59.999Z");
  });

  test("starts the selected rolling month range at UTC midnight", () => {
    expect(monthsAgo(3, new Date("2026-03-31T23:30:00.000Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});