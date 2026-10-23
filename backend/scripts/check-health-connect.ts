import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/config/prisma";
import { healthConnectService } from "../src/modules/health/health-connect.service";
import { healthSyncPrisma } from "../src/modules/health/health-connect.prisma";
import express from "express";
import request from "supertest";
import { healthConnectRoutes } from "../src/modules/health/health-connect.routes";
import { AppError } from "../src/utils/app-error";

async function main() {
  const app = express();
  app.use(express.json());
  app.use("/health", healthConnectRoutes);
  app.use((error: AppError, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.statusCode ?? 500).json({message:error.message}));
  assert.equal((await request(app).get("/health/sync/status")).status, 401);
  console.log("PASS: unauthorized API access denied");
  const userIds: string[] = [];
  try {
    for (const name of ["Health Sync Test A", "Health Sync Test B"]) {
      const user = await prisma.user.create({data:{name,email:`health-sync-${randomUUID()}@example.invalid`}});
      userIds.push(user.id);
    }
    const [userA, userB] = userIds;
    const connection = await healthConnectService.connect(userA, {deviceName:"Test device",timezone:"Asia/Kolkata",enabledMetrics:["STEPS","SLEEP","EXERCISE","WEIGHT","HEART_RATE"],grantedMetrics:["STEPS","SLEEP","EXERCISE","WEIGHT","HEART_RATE"],backgroundReadGranted:true,backgroundReadAvailable:true,consent:true});
    const now = new Date().toISOString();
    const day = "2026-10-05";
    const recordTime = `${day}T12:00:00.000Z`;
    const record = {sourceRecordId:randomUUID(),metricType:"STEPS",source:"test-source",value:100,unit:"count",startTime:recordTime,endTime:recordTime,modifiedAt:now};
    const batch = {connectionId:connection.id,generation:connection.generation,batchId:randomUUID(),syncStartedAt:now,completed:false,records:[record],deletions:[],daily:[{date:day,steps:100,sleepMinutes:420,exerciseMinutes:30,weightKg:70,averageHeartRate:65}]};
    const receipt = await healthConnectService.sync(userA,batch);
    const duplicate = await healthConnectService.sync(userA,batch);
    assert.equal(receipt.id,duplicate.id);
    assert.equal(await prisma.healthImportedRecord.count({where:{connectionId:connection.id}}),1);
    await healthConnectService.sourcePreferences(userA,connection.id,{primarySources:{STEPS:"test-source"}});
    let summary = await prisma.healthDailySummary.findUnique({where:{connectionId_date:{connectionId:connection.id,date:day}}});
    assert.equal(summary?.steps,100);
    assert.equal((summary?.nativeReference as {steps?:number})?.steps,100);
    assert.equal((summary?.provenance as {STEPS?:{source?:string;primarySource?:string}})?.STEPS?.source,"HEALTH_CONNECT");
    console.log("PASS: transactional ingestion and duplicate retry");
    await assert.rejects(healthConnectService.sync(userB,{...batch,batchId:randomUUID()}),{statusCode:404});
    console.log("PASS: User B cannot access User A's connection");
    await healthConnectService.sync(userA,{...batch,batchId:randomUUID(),records:[{...record,value:200,modifiedAt:new Date(Date.now()+1000).toISOString()}],daily:[{date:day,steps:200}]});
    assert.equal(Number((await prisma.healthImportedRecord.findFirst({where:{connectionId:connection.id}}))!.value),200);
    await prisma.dailyWellnessLog.create({data:{userId:userA,date:new Date(`${day}T00:00:00Z`),steps:12}});
    await healthConnectService.sync(userA,{...batch,batchId:randomUUID(),records:[],daily:[{date:day,steps:999}]});
    summary = await prisma.healthDailySummary.findUnique({where:{connectionId_date:{connectionId:connection.id,date:day}}});
    assert.equal(summary?.steps,12);
    assert.equal((summary?.nativeReference as {steps?:number})?.steps,999);
    assert.equal((summary?.provenance as {STEPS?:{source?:string}})?.STEPS?.source,"MANUAL");
    await healthConnectService.sync(userA,{...batch,batchId:randomUUID(),records:[],deletions:[{sourceRecordId:record.sourceRecordId,metricType:"STEPS"}],daily:[{date:day,steps:null}],completed:true});
    assert.equal(await prisma.healthImportedRecord.count({where:{connectionId:connection.id}}),0);
    summary = await prisma.healthDailySummary.findUnique({where:{connectionId_date:{connectionId:connection.id,date:day}}});
    assert.equal(summary?.steps,12);
    const status = await healthConnectService.status(userA);
    assert.equal(status.connection!.status,"SUCCESS");
    assert.ok(status.connection!.lastSuccessfulSyncAt);
    await healthConnectService.manual(userA,connection.id);
    assert.ok((await healthConnectService.status(userA)).connection!.manualRequestedAt);
    console.log("PASS: modified/deleted records, daily summary, successful status and manual request");
    await healthConnectService.removeImported(userA,connection.id);
    assert.equal(await prisma.dailyWellnessLog.count({where:{userId:userA}}),1);
    assert.equal(await prisma.healthDailySummary.count({where:{connectionId:connection.id}}),0);
    await assert.rejects(healthConnectService.sync(userA,{...batch,batchId:randomUUID()}),{statusCode:409});
    console.log("PASS: deletion preserves manual data and blocks queued reimport");
  } finally {
    await prisma.user.deleteMany({where:{id:{in:userIds}}});
    await healthSyncPrisma.$disconnect();
    await prisma.$disconnect();
    console.log("Temporary test accounts cleaned up");
  }
}
main().catch(error => { console.error("Health Connect smoke check failed:", error); process.exitCode=1; });