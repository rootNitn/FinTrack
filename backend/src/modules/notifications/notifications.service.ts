import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";

export const notificationsService = {
  async list(userId: string, unreadOnly: boolean) {
    const where: Prisma.NotificationWhereInput = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    return prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 });
  },

  async unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  async markRead(userId: string, id: string) {
    const existing = await prisma.notification.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Notification not found");
    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  },

  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { updatedCount: result.count };
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.notification.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Notification not found");
    await prisma.notification.delete({ where: { id } });
  },
};
