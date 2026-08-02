import { prisma } from "../config/prisma";

/** Mirrors NotificationType (minus SYSTEM, which is never user-toggleable) as user-facing preference keys. */
export type NotificationPreferenceKey =
  | "fdMaturity"
  | "sipReminder"
  | "goalAchievement"
  | "monthlySummary"
  | "largeExpenseAlert"
  | "fdRateChange"
  | "higherFdRateAvailable"
  | "fdRenewalReminder"
  | "ccPaymentDue"
  | "emiDue"
  | "budgetExceeded"
  | "insuranceRenewal"
  | "birthdayReminder";

/** A user hasn't opted out unless the key is explicitly set to false, so missing/legacy settings default to enabled. */
export async function isNotificationEnabled(userId: string, key: NotificationPreferenceKey): Promise<boolean> {
  const setting = await prisma.setting.findUnique({ where: { userId }, select: { notificationPreferences: true } });
  const preferences = (setting?.notificationPreferences as Record<string, boolean>) ?? {};
  return preferences[key] !== false;
}

/** Batch variant for jobs that loop over many users at once, to avoid one query per user. */
export async function getNotificationPreferencesMap(userIds: string[]): Promise<Map<string, Record<string, boolean>>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const settings = await prisma.setting.findMany({
    where: { userId: { in: uniqueIds } },
    select: { userId: true, notificationPreferences: true },
  });

  const map = new Map<string, Record<string, boolean>>();
  for (const setting of settings) {
    map.set(setting.userId, (setting.notificationPreferences as Record<string, boolean>) ?? {});
  }
  return map;
}

/** Reads a preference out of a map produced by {@link getNotificationPreferencesMap}. */
export function isEnabledInMap(
  map: Map<string, Record<string, boolean>>,
  userId: string,
  key: NotificationPreferenceKey
): boolean {
  return map.get(userId)?.[key] !== false;
}
