import { addMonthsClamped, addRecurrenceInterval, nextMonthlyOccurrence } from "./recurrence.util";

describe("addMonthsClamped", () => {
  it("clamps Jan 31 + 1 month to Feb 28 (non-leap year)", () => {
    const result = addMonthsClamped(new Date(2026, 0, 31), 1);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it("clamps Jan 31 + 1 month to Feb 29 (leap year)", () => {
    const result = addMonthsClamped(new Date(2024, 0, 31), 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it("does not drift forward across repeated month-end additions", () => {
    let date = new Date(2026, 0, 31);
    for (let i = 0; i < 3; i++) date = addMonthsClamped(date, 1);
    // Jan 31 -> Feb 28 -> Mar 28 -> Apr 28 (stays anchored at 28, never jumps to the 1st/3rd)
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(28);
  });

  it("handles year rollover", () => {
    const result = addMonthsClamped(new Date(2026, 11, 15), 2);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(15);
  });
});

describe("addRecurrenceInterval", () => {
  it("WEEKLY adds 7 days", () => {
    const result = addRecurrenceInterval(new Date(2026, 0, 1), "WEEKLY");
    expect(result.getDate()).toBe(8);
  });

  it("MONTHLY is month-end clamped", () => {
    const result = addRecurrenceInterval(new Date(2026, 0, 31), "MONTHLY");
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it("YEARLY handles Feb 29 on a non-leap target year", () => {
    const result = addRecurrenceInterval(new Date(2024, 1, 29), "YEARLY");
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });
});

describe("nextMonthlyOccurrence", () => {
  it("clamps day 31 into a 28-day February instead of overflowing to March", () => {
    const from = new Date(2026, 1, 1); // Feb 1, 2026
    const result = nextMonthlyOccurrence(31, from);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it("rolls to next month when the clamped day has already passed", () => {
    const from = new Date(2026, 1, 28, 12, 0, 0); // Feb 28, 2026 noon (clamped day-31 candidate at midnight is already in the past)
    const result = nextMonthlyOccurrence(31, from);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(31);
  });
});
