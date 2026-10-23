jest.mock("./health-connect.prisma", () => ({ healthSyncPrisma: {
  $transaction: jest.fn(), healthConnection: { findFirst: jest.fn(), findUnique: jest.fn() },
  healthDailySummary: { findMany: jest.fn().mockResolvedValue([]) },
  healthImportedRecord: { findMany: jest.fn().mockResolvedValue([]) },
} }));
import { healthSyncPrisma as prisma } from "./health-connect.prisma";
import { healthConnectService } from "./health-connect.service";
import express from "express";
import request from "supertest";
import { healthConnectRoutes } from "./health-connect.routes";
import { signAccessToken } from "../../utils/jwt";

describe("Health Connect synchronization boundaries", () => {
  const connectionId = "00000000-0000-4000-8000-000000000001";
  const input = { connectionId, generation: 0, batchId: "00000000-0000-4000-8000-000000000002", syncStartedAt: "2026-10-05T00:00:00Z", completed: true, records: [], deletions: [], daily: [] };
  let transaction: any;
  beforeEach(() => {
    transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      healthConnection: { findFirst: jest.fn().mockResolvedValue({ id: connectionId, userId: "user-a", generation: 0, timezone: "UTC", primarySources: { STEPS: "source-app" }, enabledMetrics: ["STEPS"], grantedMetrics: ["STEPS"] }), update: jest.fn() },
      healthSyncRun: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({data}) => Promise.resolve(data)), aggregate: jest.fn().mockResolvedValue({ _sum: { recordsUploaded: 0, recordsDeleted: 0 } }) },
      healthImportedRecord: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn(), deleteMany: jest.fn().mockResolvedValue({count:0}) },
      healthDailySummary: { upsert: jest.fn() },
      dailyWellnessLog: { findUnique: jest.fn().mockResolvedValue(null) },
      bodyMetricLog: { findMany: jest.fn().mockResolvedValue([]) },
      workoutLog: { findMany: jest.fn().mockResolvedValue([]) },
      vitalLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(operation => operation(transaction));
  });
  test("rejects User A uploading to User B's connection", async () => {
    transaction.healthConnection.findFirst.mockResolvedValue(null);
    await expect(healthConnectService.sync("user-a", input)).rejects.toMatchObject({ statusCode: 404 });
    expect(transaction.healthConnection.findFirst).toHaveBeenCalledWith({ where: {id:connectionId,userId:"user-a"} });
    expect(transaction.healthSyncRun.create).not.toHaveBeenCalled();
  });
  test("rejects disconnected and invalidated queued uploads", async () => {
    transaction.healthConnection.findFirst.mockResolvedValue({generation:1,disconnectedAt:new Date()});
    await expect(healthConnectService.sync("user-a", input)).rejects.toMatchObject({ statusCode: 409 });
  });
  test("replayed batch returns its receipt without reapplying data", async () => {
    transaction.healthSyncRun.findUnique.mockResolvedValue({batchId:input.batchId});
    await healthConnectService.sync("user-a",input);
    expect(transaction.healthSyncRun.create).not.toHaveBeenCalled();
    expect(transaction.healthConnection.update).not.toHaveBeenCalled();
  });
  test("empty successful sync advances checkpoint with zero count", async () => {
    await healthConnectService.sync("user-a",input);
    expect(transaction.healthConnection.update.mock.calls[0][0].data).toMatchObject({status:"SUCCESS",recordsSynced:0,lastSuccessfulSyncAt:new Date(input.syncStartedAt)});
  });
  test("failed upload does not advance successful timestamp", async () => {
    transaction.healthSyncRun.create.mockRejectedValue(new Error("offline"));
    await expect(healthConnectService.sync("user-a",input)).rejects.toThrow("offline");
    expect(transaction.healthConnection.update).not.toHaveBeenCalled();
  });
  test("rejects unpermitted metric and daily fields", async () => {
    await expect(healthConnectService.sync("user-a", {...input,daily:[{date:"2026-10-05",sleepMinutes:400}]})).rejects.toMatchObject({statusCode:403});
  });
  test("newer source versions replace existing records", async () => {
    const syncedRecord = { metricType: "STEPS", sourceRecordId: "steps-1", source: "source-app", value: 120, unit: "count", startTime: new Date(input.syncStartedAt), endTime: new Date(input.syncStartedAt), modifiedAt: new Date(input.syncStartedAt), rawData: null };
    transaction.healthImportedRecord.findUnique.mockResolvedValue({
      metricType: "STEPS", source: "source-app", value: 0,
      startTime: new Date(input.syncStartedAt), endTime: new Date(input.syncStartedAt),
      modifiedAt: new Date("2026-10-04T00:00:00Z"), rawData: null,
    });
    transaction.healthImportedRecord.findMany.mockResolvedValue([syncedRecord]);
    const record = {metricType:"STEPS",sourceRecordId:"steps-1",source:"source-app",startTime:input.syncStartedAt,endTime:input.syncStartedAt,modifiedAt:input.syncStartedAt,value:120,unit:"count"};
    await healthConnectService.sync("user-a", {...input,records:[record],daily:[{date:"2026-10-05",steps:999}]});
    expect(transaction.healthImportedRecord.upsert).toHaveBeenCalledTimes(1);
    const referenceWrite = transaction.healthDailySummary.upsert.mock.calls[0][0];
    expect(referenceWrite.create.nativeReference).toMatchObject({ steps: 999 });
    const canonicalWrite = transaction.healthDailySummary.upsert.mock.calls.at(-1)![0];
    expect(canonicalWrite.create).toMatchObject({ steps: 120, aggregationVersion: 1, provenance: { STEPS: { source: "HEALTH_CONNECT", primarySource: "source-app" } } });
  });
  test("reconciliation only deletes missing records in a completed permitted scope", async () => {
    const scope = {metricType:"STEPS",from:"2026-10-01T00:00:00Z",to:input.syncStartedAt,sourceRecordIds:["retained"]};
    await healthConnectService.sync("user-a", {...input,reconciliation:scope});
    expect(transaction.healthImportedRecord.deleteMany.mock.calls[0][0].where).toMatchObject({connectionId,metricType:"STEPS",sourceRecordId:{notIn:["retained"]}});
  });
  test("unexpected errors do not expose submitted health values", async () => {
    const app = express();
    app.use(express.json());
    app.use("/health",healthConnectRoutes);
    transaction.healthSyncRun.create.mockRejectedValue(new Error("sensitive submitted health payload"));
    const token = signAccessToken({sub:"user-a",email:"test@example.invalid",role:"USER"});
    const response = await request(app).post("/health/sync").set("Authorization",`Bearer ${token}`).send(input);
    expect(response.status).toBe(503);
    expect(response.text).not.toContain("sensitive");
    expect(response.text).not.toContain("stack");
  });
  test("canonical daily summary responses are not cached", async () => {
    (prisma.healthConnection.findUnique as jest.Mock).mockResolvedValue(null);
    const app = express();
    app.use(express.json());
    app.use("/health",healthConnectRoutes);
    const token = signAccessToken({sub:"user-a",email:"test@example.invalid",role:"USER"});
    const response = await request(app).get("/health/daily?days=1").set("Authorization",`Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});