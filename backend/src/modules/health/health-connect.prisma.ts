import { PrismaClient } from "@prisma/client";

declare global {
  var __healthSyncPrisma: PrismaClient | undefined;
}

export const healthSyncPrisma = global.__healthSyncPrisma ?? new PrismaClient({ log: [] });
global.__healthSyncPrisma = healthSyncPrisma;