import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { isNotificationEnabled } from "../utils/notification-preferences";

async function notifyOnce(userId: string, meta: Record<string, unknown>, title: string, message: string) {
  if (!(await isNotificationEnabled(userId, "businessInvoiceDue"))) return false;
  const metaJson = meta as Prisma.InputJsonObject;
  const existing = await prisma.notification.findFirst({ where: { userId, type: "BUSINESS_INVOICE_DUE", meta: { equals: metaJson } } });
  if (existing) return false;
  await prisma.notification.create({ data: { userId, type: "BUSINESS_INVOICE_DUE", title, message, meta: metaJson } });
  return true;
}

/** Notifies once for invoices due today or already overdue, keyed by invoice and due date. */
export async function runBusinessInvoiceDueCheck() {
  const now = new Date();
  const invoices = await prisma.businessSalesInvoice.findMany({
    where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lte: now } },
    include: { customer: true, business: true },
  });
  let created = 0;
  for (const invoice of invoices) {
    const overdueDays = Math.max(0, Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86400000));
    const outstanding = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (outstanding <= 0) continue;
    const dueDate = invoice.dueDate.toISOString().slice(0, 10);
    const title = overdueDays > 0 ? "Business invoice overdue" : "Business invoice due today";
    const message = overdueDays > 0
      ? `${invoice.invoiceNumber} for ${invoice.customer.name} is ${overdueDays} day(s) overdue. Outstanding: ${outstanding.toFixed(2)}.`
      : `${invoice.invoiceNumber} for ${invoice.customer.name} is due today. Outstanding: ${outstanding.toFixed(2)}.`;
    if (await notifyOnce(invoice.business.userId, { invoiceId: invoice.id, dueDate }, title, message)) created += 1;
  }
  logger.info({ created, checked: invoices.length }, "Business invoice due check completed");
}
