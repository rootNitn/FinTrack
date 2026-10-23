import { Prisma } from "@prisma/client";
import { healthSyncPrisma as prisma } from "./health-connect.prisma";
import { AppError } from "../../utils/app-error";
import { healthConnectionSchema, healthPermissionSchema, healthSourcePreferenceSchema, healthSyncSchema, healthSyncStatusSchema, healthLocalDate } from "./health-connect.dto";
import { aggregateHealthDay, healthLocalDayBounds, healthLocalDate as healthMetricLocalDate, healthRecordDays, HealthAggregateRecord, HealthMetric } from "./health-aggregation.util";

type PrimarySources = Partial<Record<HealthMetric, string>>;

function asPrimarySources(value: Prisma.JsonValue): PrimarySources {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [HealthMetric, string] =>
    ["STEPS", "SLEEP", "EXERCISE", "WEIGHT", "HEART_RATE"].includes(entry[0]) && typeof entry[1] === "string",
  ));
}

async function manualValues(tx: Prisma.TransactionClient, userId: string, date: string, timezone: string) {
  const { start, end } = healthLocalDayBounds(date, timezone);
  const utcDate = new Date(`${date}T00:00:00.000Z`);
  const [daily, bodyMetrics, workouts, heartRates] = await Promise.all([
    tx.dailyWellnessLog.findUnique({ where: { userId_date: { userId, date: utcDate } } }),
    tx.bodyMetricLog.findMany({ where: { userId, recordedAt: { gte: start, lt: end } }, orderBy: { recordedAt: "desc" } }),
    tx.workoutLog.findMany({ where: { userId, date: { gte: start, lt: end } }, select: { durationMinutes: true } }),
    tx.vitalLog.findMany({ where: { userId, type: "HEART_RATE", recordedAt: { gte: start, lt: end }, value: { not: null } }, select: { value: true } }),
  ]);
  const workoutMinutes = workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);
  return {
    steps: daily?.steps,
    sleepMinutes: daily?.sleepHours == null ? undefined : Number(daily.sleepHours) * 60,
    exerciseMinutes: workouts.length ? workoutMinutes : undefined,
    weightKg: bodyMetrics.length ? Number(bodyMetrics[0].weightKg) : undefined,
    heartRates: heartRates.flatMap(vital => vital.value == null ? [] : [Number(vital.value)]),
  };
}

function aggregateRecords(records: Array<{ metricType: string; source: string; value: Prisma.Decimal; startTime: Date; endTime: Date; modifiedAt: Date; rawData: Prisma.JsonValue | null }>): HealthAggregateRecord[] {
  return records.map(record => ({
    ...record,
    metricType: record.metricType as HealthMetric,
    value: Number(record.value),
    rawData: record.rawData ?? undefined,
  }));
}

async function reaggregateDay(tx: Prisma.TransactionClient, connection: { id: string; userId: string; timezone: string; primarySources: Prisma.JsonValue }, date: string) {
  const { start, end } = healthLocalDayBounds(date, connection.timezone);
  const [records, manual] = await Promise.all([
    tx.healthImportedRecord.findMany({ where: { connectionId: connection.id, startTime: { lt: end }, endTime: { gte: start } } }),
    manualValues(tx, connection.userId, date, connection.timezone),
  ]);
  const canonical = aggregateHealthDay({
    date,
    timezone: connection.timezone,
    records: aggregateRecords(records),
    primarySources: asPrimarySources(connection.primarySources),
    manual,
  });
  const canonicalData = { ...canonical, provenance: canonical.provenance as unknown as Prisma.InputJsonValue };
  await tx.healthDailySummary.upsert({
    where: { connectionId_date: { connectionId: connection.id, date } },
    create: { connectionId: connection.id, date, ...canonicalData },
    update: canonicalData,
  });
}

export async function refreshCanonicalHealthDay(userId: string, dateValue: Date | string): Promise<void> {
  const connection = await prisma.healthConnection.findUnique({ where: { userId } });
  if (!connection) return;
  const date = typeof dateValue === "string" ? dateValue.slice(0, 10) : healthMetricLocalDate(dateValue, connection.timezone);
  await prisma.$transaction(tx => reaggregateDay(tx, connection, date));
}

async function owned(userId: string, id: string) {
  const connection = await prisma.healthConnection.findFirst({ where: { id, userId } });
  if (!connection) throw AppError.notFound("Health connection not found");
  return connection;
}

export const healthConnectService = {
  async connect(userId: string, body: unknown) {
    const { consent, ...input } = healthConnectionSchema.parse(body);
    const existing = await prisma.healthConnection.findUnique({ where: { userId } });
    if (existing && !existing.disconnectedAt) throw AppError.conflict("Disconnect the current phone before connecting another.");
    return prisma.healthConnection.upsert({
      where: { userId },
      create: { userId, ...input },
      update: { ...input, disconnectedAt: null, consentedAt: new Date(), generation: { increment: 1 }, status: "CONNECTED", errorCode: null },
    });
  },

  async permissions(userId: string, id: string, body: unknown) {
    const connection = await owned(userId, id);
    if (connection.disconnectedAt) throw AppError.conflict("Connection is disconnected");
    const input = healthPermissionSchema.parse(body);
    return prisma.healthConnection.update({ where: { id, userId }, data: { ...input } });
  },

  async sourcePreferences(userId: string, id: string, body: unknown) {
    const connection = await owned(userId, id);
    if (connection.disconnectedAt) throw AppError.conflict("Connection is disconnected");
    const input = healthSourcePreferenceSchema.parse(body);
    for (const [metricType, source] of Object.entries(input.primarySources)) {
      if (!source) continue;
      const record = await prisma.healthImportedRecord.findFirst({ where: { connectionId: id, metricType, source } });
      if (!record) throw AppError.badRequest("Select a source that has imported records for this metric.");
    }
    return prisma.$transaction(async tx => {
      const updated = await tx.healthConnection.update({ where: { id, userId }, data: { primarySources: input.primarySources } });
      const summaries = await tx.healthDailySummary.findMany({ where: { connectionId: id }, select: { date: true } });
      const updatedConnection = { ...connection, primarySources: updated.primarySources };
      for (const summary of summaries) await reaggregateDay(tx, updatedConnection, summary.date);
      return updated;
    });
  },

  async status(userId: string) {
    const connection = await prisma.healthConnection.findUnique({ where: { userId } });
    if (!connection) return { connection: null, lastRun: null };
    const lastRun = await prisma.healthSyncRun.findFirst({ where: { connectionId: connection.id }, orderBy: { completedAt: "desc" } });
    return { connection, lastRun };
  },

  async report(userId: string, id: string, body: unknown) {
    const input = healthSyncStatusSchema.parse(body);
    const connection = await owned(userId, id);
    if (connection.disconnectedAt) throw AppError.conflict("Connection is disconnected");
    return prisma.healthConnection.update({ where: { id, userId }, data: { status: input.status, errorCode: input.errorCode, lastAttemptedSyncAt: new Date() } });
  },

  async manual(userId: string, id: string) {
    const connection = await owned(userId, id);
    if (connection.disconnectedAt) throw AppError.conflict("Connection is disconnected");
    await prisma.healthConnection.update({ where: { id, userId }, data: { manualRequestedAt: new Date() } });
    return { message: "Sync requested. The phone will pick it up on its next permitted background execution." };
  },

  async disconnect(userId: string, id: string) {
    await owned(userId, id);
    return prisma.healthConnection.update({ where: { id, userId }, data: { disconnectedAt: new Date(), generation: { increment: 1 }, status: "DISCONNECTED", manualRequestedAt: null } });
  },

  async removeImported(userId: string, id: string) {
    await owned(userId, id);
    await prisma.$transaction(async tx => {
      await tx.healthConnection.update({ where: { id, userId }, data: { generation: { increment: 1 }, disconnectedAt: new Date(), status: "DISCONNECTED", lastSuccessfulSyncAt: null, recordsSynced: 0, manualRequestedAt: null } });
      await tx.healthImportedRecord.deleteMany({ where: { connectionId: id } });
      await tx.healthDailySummary.deleteMany({ where: { connectionId: id } });
      await tx.healthSyncRun.deleteMany({ where: { connectionId: id } });
    });
    return { message: "Imported health data deleted and synchronization disconnected. Manual entries are unchanged." };
  },

  async sync(userId: string, body: unknown) {
    const input = healthSyncSchema.parse(body);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM health_connections WHERE id = ${input.connectionId} AND "userId" = ${userId} FOR UPDATE`;
      const connection = await tx.healthConnection.findFirst({ where: { id: input.connectionId, userId } });
      if (!connection) throw AppError.notFound("Health connection not found");
      if (connection.disconnectedAt || connection.generation !== input.generation) throw AppError.conflict("Connection changed. Discard queued data and reconnect if needed.");
      const previous = await tx.healthSyncRun.findUnique({ where: { connectionId_batchId: { connectionId: connection.id, batchId: input.batchId } } });
      if (previous) return previous;
      const permitted = connection.enabledMetrics.filter(metric => connection.grantedMetrics.includes(metric));
      if ([...input.records, ...input.deletions].some(record => !permitted.includes(record.metricType))) throw AppError.forbidden("A metric is not enabled or its permission was not granted.");
      const fields: Record<string, string> = { steps: "STEPS", sleepMinutes: "SLEEP", exerciseMinutes: "EXERCISE", weightKg: "WEIGHT", averageHeartRate: "HEART_RATE" };
      for (const day of input.daily) {
        for (const field of Object.keys(fields)) {
          if (field in day && !permitted.includes(fields[field])) throw AppError.forbidden("Daily summary includes an unpermitted metric.");
        }
      }
      const startedAt = new Date(input.syncStartedAt);
      if (startedAt.getTime() > Date.now() + 300000) throw AppError.badRequest("Phone time is ahead of server time.");
      if (connection.lastSuccessfulSyncAt && startedAt < connection.lastSuccessfulSyncAt) throw AppError.conflict("Stale sync attempt. Read changes again.");
      const affectedDates = new Set(input.daily.map(day => day.date));
      let uploaded = 0;
      let skipped = 0;
      let deleted = 0;
      for (const record of input.records) {
        const key = { connectionId: connection.id, metricType: record.metricType, sourceRecordId: record.sourceRecordId };
        const existing = await tx.healthImportedRecord.findUnique({ where: { connectionId_metricType_sourceRecordId: key } });
        if (existing && existing.modifiedAt >= new Date(record.modifiedAt)) { skipped++; continue; }
        if (existing) for (const date of healthRecordDays(aggregateRecords([existing])[0], connection.timezone)) affectedDates.add(date);
        const data = { ...record, rawData: record.rawData as Prisma.InputJsonValue | undefined, startTime: new Date(record.startTime), endTime: new Date(record.endTime), modifiedAt: new Date(record.modifiedAt) };
        await tx.healthImportedRecord.upsert({ where: { connectionId_metricType_sourceRecordId: key }, create: { ...data, connectionId: connection.id }, update: data });
        for (const date of healthRecordDays({ ...record, startTime: data.startTime, endTime: data.endTime, modifiedAt: data.modifiedAt }, connection.timezone)) affectedDates.add(date);
        uploaded++;
      }
      for (const record of input.deletions) {
        const existing = await tx.healthImportedRecord.findUnique({ where: { connectionId_metricType_sourceRecordId: { connectionId: connection.id, metricType: record.metricType, sourceRecordId: record.sourceRecordId } } });
        if (existing) for (const date of healthRecordDays(aggregateRecords([existing])[0], connection.timezone)) affectedDates.add(date);
        const result = await tx.healthImportedRecord.deleteMany({ where: { connectionId: connection.id, metricType: record.metricType, sourceRecordId: record.sourceRecordId } });
        deleted += result.count;
      }
      if (input.reconciliation) {
        const scope = input.reconciliation;
        if (!permitted.includes(scope.metricType)) throw AppError.forbidden("Reconciliation metric is not permitted.");
        const missing = await tx.healthImportedRecord.findMany({ where: {
          connectionId: connection.id, metricType: scope.metricType,
          startTime: { gte: new Date(scope.from), lt: new Date(scope.to) },
          sourceRecordId: { notIn: scope.sourceRecordIds },
        } });
        for (const record of missing) for (const date of healthRecordDays(aggregateRecords([record])[0], connection.timezone)) affectedDates.add(date);
        const result = await tx.healthImportedRecord.deleteMany({ where: {
          connectionId: connection.id, metricType: scope.metricType,
          startTime: { gte: new Date(scope.from), lt: new Date(scope.to) },
          sourceRecordId: { notIn: scope.sourceRecordIds },
        } });
        deleted += result.count;
      }
      for (const { date, ...day } of input.daily) {
        const nativeReference = day as Prisma.InputJsonValue;
        await tx.healthDailySummary.upsert({
          where: { connectionId_date: { connectionId: connection.id, date } },
          create: { connectionId: connection.id, date, nativeReference },
          update: { nativeReference },
        });
      }
      for (const date of affectedDates) await reaggregateDay(tx, connection, date);
      const run = await tx.healthSyncRun.create({ data: { connectionId: connection.id, batchId: input.batchId, syncStartedAt: startedAt, recordsRead: input.records.length + input.deletions.length, recordsUploaded: uploaded, recordsSkipped: skipped, recordsDeleted: deleted, completed: input.completed } });
      const counts = await tx.healthSyncRun.aggregate({ where: { connectionId: connection.id, syncStartedAt: startedAt }, _sum: { recordsUploaded: true, recordsDeleted: true } });
      await tx.healthConnection.update({ where: { id: connection.id }, data: {
        lastAttemptedSyncAt: new Date(), status: input.completed ? "SUCCESS" : "SYNCING", errorCode: null,
        ...(input.completed ? { lastSuccessfulSyncAt: startedAt, syncCompletedAt: new Date(), recordsSynced: (counts._sum.recordsUploaded ?? 0) + (counts._sum.recordsDeleted ?? 0), manualRequestedAt: null } : {}),
      } });
      return run;
    }, { timeout: 30000 });
  },

  async daily(userId: string, days: number) {
    const connection = await prisma.healthConnection.findUnique({ where: { userId } });
    const emptySources = { STEPS: [], SLEEP: [], EXERCISE: [], WEIGHT: [], HEART_RATE: [] };
    if (!connection) return { connectionId: null, timezone: "UTC", today: healthLocalDate(new Date(), "UTC"), primarySources: {}, sources: emptySources, days: [] };
    const today = healthLocalDate(new Date(), connection.timezone);
    const start = new Date(`${today}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - days + 1);
    const [rows, sourceRows] = await Promise.all([
      prisma.healthDailySummary.findMany({ where: { connectionId: connection.id, date: { gte: start.toISOString().slice(0, 10), lte: today } }, orderBy: { date: "asc" } }),
      prisma.healthImportedRecord.findMany({ where: { connectionId: connection.id }, select: { metricType: true, source: true }, distinct: ["metricType", "source"] }),
    ]);
    const sources = { ...emptySources } as Record<HealthMetric, string[]>;
    for (const row of sourceRows) if (row.metricType in sources && !sources[row.metricType as HealthMetric].includes(row.source)) sources[row.metricType as HealthMetric].push(row.source);
    for (const values of Object.values(sources)) values.sort((left, right) => left.localeCompare(right));
    return {
      connectionId: connection.id,
      timezone: connection.timezone,
      today,
      primarySources: asPrimarySources(connection.primarySources),
      sources,
      days: rows.map(row => ({ ...row, sleepMinutes: row.sleepMinutes === null ? null : Number(row.sleepMinutes), exerciseMinutes: row.exerciseMinutes === null ? null : Number(row.exerciseMinutes), weightKg: row.weightKg === null ? null : Number(row.weightKg), averageHeartRate: row.averageHeartRate === null ? null : Number(row.averageHeartRate) })),
    };
  },
};