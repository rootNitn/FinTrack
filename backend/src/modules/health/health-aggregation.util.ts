export const HEALTH_AGGREGATION_VERSION = 1;

export type HealthMetric = "STEPS" | "SLEEP" | "EXERCISE" | "WEIGHT" | "HEART_RATE";

export interface HealthAggregateRecord {
  metricType: HealthMetric;
  source: string;
  value: number | string;
  startTime: Date | string;
  endTime: Date | string;
  modifiedAt: Date | string;
  rawData?: unknown;
}

export interface ManualHealthDay {
  steps?: number | null;
  sleepMinutes?: number | null;
  exerciseMinutes?: number | null;
  weightKg?: number | null;
  heartRates?: number[];
}

export interface HealthMetricProvenance {
  source: "MANUAL" | "HEALTH_CONNECT" | "NONE";
  primarySource: string | null;
  recordCount: number;
}

export interface CanonicalHealthDay {
  steps: number | null;
  sleepMinutes: number | null;
  exerciseMinutes: number | null;
  weightKg: number | null;
  averageHeartRate: number | null;
  aggregationVersion: number;
  provenance: Record<HealthMetric, HealthMetricProvenance>;
}

const metricFields: Record<HealthMetric, keyof ManualHealthDay> = {
  STEPS: "steps",
  SLEEP: "sleepMinutes",
  EXERCISE: "exerciseMinutes",
  WEIGHT: "weightKg",
  HEART_RATE: "heartRates",
};

function dateParts(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function healthLocalDate(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return `${parts.find(part => part.type === "year")!.value}-${parts.find(part => part.type === "month")!.value}-${parts.find(part => part.type === "day")!.value}`;
}

function localMidnight(date: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const desiredUtc = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let candidate = desiredUtc;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const actualUtc = Date.UTC(
      Number(parts.find(part => part.type === "year")!.value),
      Number(parts.find(part => part.type === "month")!.value) - 1,
      Number(parts.find(part => part.type === "day")!.value),
      Number(parts.find(part => part.type === "hour")!.value),
      Number(parts.find(part => part.type === "minute")!.value),
      Number(parts.find(part => part.type === "second")!.value),
    );
    const adjustment = desiredUtc - actualUtc;
    candidate += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(candidate);
}

function addCalendarDays(date: string, count: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

export function healthLocalDayBounds(date: string, timezone: string): { start: Date; end: Date } {
  return { start: localMidnight(date, timezone), end: localMidnight(addCalendarDays(date, 1), timezone) };
}

export function healthRecordDays(record: HealthAggregateRecord, timezone: string): string[] {
  const start = dateParts(record.startTime);
  const end = dateParts(record.endTime);
  const first = healthLocalDate(start, timezone);
  if (record.metricType === "WEIGHT" || record.metricType === "SLEEP" || end <= start) {
    return [healthLocalDate(record.metricType === "SLEEP" ? end : start, timezone)];
  }
  const last = healthLocalDate(end, timezone);
  const dates: string[] = [];
  let current = first;
  while (current <= last && dates.length < 32) {
    dates.push(current);
    current = addCalendarDays(current, 1);
  }
  return dates;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function recordValue(record: HealthAggregateRecord): number {
  const value = Number(record.value);
  return Number.isFinite(value) ? value : 0;
}

function recordRawData(record: HealthAggregateRecord): Record<string, unknown> {
  return record.rawData && typeof record.rawData === "object" ? record.rawData as Record<string, unknown> : {};
}

function overlapMs(record: HealthAggregateRecord, dayStart: number, dayEnd: number): number {
  const start = dateParts(record.startTime).getTime();
  const end = dateParts(record.endTime).getTime();
  if (end <= start) return start >= dayStart && start < dayEnd ? 1 : 0;
  return Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart));
}

function nonOverlapping(records: HealthAggregateRecord[], dayStart: number, dayEnd: number): HealthAggregateRecord[] {
  const ordered = [...records].sort((left, right) => dateParts(right.modifiedAt).getTime() - dateParts(left.modifiedAt).getTime());
  const accepted: HealthAggregateRecord[] = [];
  for (const record of ordered) {
    const start = Math.max(dateParts(record.startTime).getTime(), dayStart);
    const end = Math.min(dateParts(record.endTime).getTime(), dayEnd);
    if (accepted.some(item => start < Math.min(dateParts(item.endTime).getTime(), dayEnd) && Math.max(dateParts(item.startTime).getTime(), dayStart) < end)) continue;
    accepted.push(record);
  }
  return accepted;
}

function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  const merged: Array<[number, number]> = [];
  for (const [start, end] of intervals.sort((left, right) => left[0] - right[0])) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function importedValue(metric: HealthMetric, records: HealthAggregateRecord[], date: string, timezone: string): number | null {
  if (!records.length) return null;
  const bounds = healthLocalDayBounds(date, timezone);
  const start = bounds.start.getTime();
  const end = bounds.end.getTime();

  switch (metric) {
    case "STEPS": {
      const rows = nonOverlapping(records, start, end);
      const total = rows.reduce((sum, record) => {
        const duration = dateParts(record.endTime).getTime() - dateParts(record.startTime).getTime();
        return sum + (duration > 0 ? recordValue(record) * overlapMs(record, start, end) / duration : (overlapMs(record, start, end) ? recordValue(record) : 0));
      }, 0);
      return Math.round(total);
    }
    case "SLEEP": {
      const intervals: Array<[number, number]> = [];
      for (const record of records.filter(item => healthLocalDate(dateParts(item.endTime), timezone) === date)) {
        const stages = recordRawData(record)["stages"];
        if (Array.isArray(stages) && stages.length) {
          for (const stage of stages) {
            if (!stage || typeof stage !== "object") continue;
            const value = stage as Record<string, unknown>;
            if (!["SLEEPING", "LIGHT", "DEEP", "REM"].includes(String(value["stage"]))) continue;
            const from = new Date(String(value["startTime"])).getTime();
            const to = new Date(String(value["endTime"])).getTime();
            if (Number.isFinite(from) && Number.isFinite(to) && to > from) intervals.push([from, to]);
          }
        } else {
          const from = dateParts(record.startTime).getTime();
          const to = dateParts(record.endTime).getTime();
          if (to > from) intervals.push([from, to]);
        }
      }
      const merged = mergeIntervals(intervals);
      return merged.length ? round2(merged.reduce((sum, [from, to]) => sum + to - from, 0) / 60000) : null;
    }
    case "EXERCISE": {
      const rows = nonOverlapping(records, start, end);
      if (!rows.length) return null;
      return round2(rows.reduce((sum, record) => {
        const duration = dateParts(record.endTime).getTime() - dateParts(record.startTime).getTime();
        return sum + (duration > 0 ? recordValue(record) * overlapMs(record, start, end) / duration : 0);
      }, 0));
    }
    case "WEIGHT": {
      const rows = records.filter(record => healthLocalDate(dateParts(record.startTime), timezone) === date);
      return rows.length ? recordValue(rows.sort((left, right) => dateParts(right.startTime).getTime() - dateParts(left.startTime).getTime())[0]) : null;
    }
    case "HEART_RATE": {
      const samples: number[] = [];
      for (const record of records) {
        const rawSamples = recordRawData(record)["samples"];
        if (Array.isArray(rawSamples)) {
          for (const sample of rawSamples) {
            if (!sample || typeof sample !== "object") continue;
            const value = sample as Record<string, unknown>;
            const bpm = Number(value["beatsPerMinute"]);
            if (Number.isFinite(bpm) && healthLocalDate(new Date(String(value["time"])), timezone) === date) samples.push(bpm);
          }
        } else if (healthLocalDate(dateParts(record.startTime), timezone) === date) {
          samples.push(recordValue(record));
        }
      }
      return samples.length ? round2(samples.reduce((sum, value) => sum + value, 0) / samples.length) : null;
    }
  }
}

export function aggregateHealthDay(input: {
  date: string;
  timezone: string;
  records: HealthAggregateRecord[];
  primarySources: Partial<Record<HealthMetric, string>>;
  manual: ManualHealthDay;
}): CanonicalHealthDay {
  const fields: Record<HealthMetric, keyof CanonicalHealthDay> = {
    STEPS: "steps",
    SLEEP: "sleepMinutes",
    EXERCISE: "exerciseMinutes",
    WEIGHT: "weightKg",
    HEART_RATE: "averageHeartRate",
  };
  const values: Partial<Record<keyof CanonicalHealthDay, number | null>> = {};
  const provenance = {} as Record<HealthMetric, HealthMetricProvenance>;

  for (const metric of Object.keys(fields) as HealthMetric[]) {
    const manualValue = input.manual[metricFields[metric]];
    if (metric === "HEART_RATE" && Array.isArray(manualValue) && manualValue.length) {
      values[fields[metric]] = round2(manualValue.reduce((sum, value) => sum + value, 0) / manualValue.length);
      provenance[metric] = { source: "MANUAL", primarySource: null, recordCount: manualValue.length };
      continue;
    }
    if (metric !== "HEART_RATE" && typeof manualValue === "number" && Number.isFinite(manualValue)) {
      values[fields[metric]] = metric === "SLEEP" ? round2(manualValue) : Math.round(manualValue);
      provenance[metric] = { source: "MANUAL", primarySource: null, recordCount: 1 };
      continue;
    }
    const primarySource = input.primarySources[metric] ?? null;
    const selected = primarySource ? input.records.filter(record => record.metricType === metric && record.source === primarySource) : [];
    const imported = importedValue(metric, selected, input.date, input.timezone);
    values[fields[metric]] = imported;
    provenance[metric] = { source: imported === null ? "NONE" : "HEALTH_CONNECT", primarySource, recordCount: imported === null ? 0 : selected.length };
  }

  return {
    steps: values["steps"] ?? null,
    sleepMinutes: values["sleepMinutes"] ?? null,
    exerciseMinutes: values["exerciseMinutes"] ?? null,
    weightKg: values["weightKg"] ?? null,
    averageHeartRate: values["averageHeartRate"] ?? null,
    aggregationVersion: HEALTH_AGGREGATION_VERSION,
    provenance,
  };
}