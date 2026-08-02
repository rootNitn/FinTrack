import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { Prisma } from "@prisma/client";

/**
 * Records an entry in the `AuditLog` table. Used across the Advanced Tax Intelligence module
 * (document uploads/deletes, imports, admin rule CRUD, etc.) to satisfy the Feature 19 security
 * requirement for audit trails. Never throws — a logging failure should not fail the caller's
 * primary operation.
 */
export async function logAudit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? undefined,
        action,
        entity,
        entityId: entityId ?? undefined,
        meta: (meta as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    logger.warn({ err, action, entity, entityId }, "Failed to write audit log entry");
  }
}
