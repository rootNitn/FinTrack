import { RecurrenceInterval } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";

function addInterval(date: Date, interval: RecurrenceInterval): Date {
  const next = new Date(date);
  if (interval === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (interval === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  return next;
}

/**
 * Generates the next occurrence for every recurring expense template whose
 * `nextRecurrenceDate` has arrived, then advances the template to the following date.
 * Stops (clears nextRecurrenceDate) once past the optional recurrenceEndDate.
 */
export async function runRecurringExpenseGeneration() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const due = await prisma.expense.findMany({
    where: { isRecurring: true, nextRecurrenceDate: { lte: today } },
  });

  let created = 0;
  for (const template of due) {
    if (!template.recurrenceInterval || !template.nextRecurrenceDate) continue;

    const occurrenceDate = template.nextRecurrenceDate;
    const upcoming = addInterval(occurrenceDate, template.recurrenceInterval);
    const stopped = template.recurrenceEndDate ? upcoming > template.recurrenceEndDate : false;

    await prisma.$transaction(async (tx) => {
      const generated = await tx.expense.create({
        data: {
          userId: template.userId,
          date: occurrenceDate,
          category: template.category,
          amount: template.amount,
          paymentMode: template.paymentMode,
          description: template.description,
          bankAccountId: template.bankAccountId,
          parentExpenseId: template.id,
          isRecurring: false,
        },
      });

      await tx.transaction.create({
        data: {
          userId: template.userId,
          type: "EXPENSE",
          amount: template.amount,
          date: occurrenceDate,
          description: template.description ?? `${template.category} expense`,
          category: template.category,
          bankAccountId: template.bankAccountId,
        },
      });

      await tx.expense.update({
        where: { id: template.id },
        data: { nextRecurrenceDate: stopped ? null : upcoming },
      });

      created += 1;
    });
  }

  logger.info({ created }, "Recurring expense generation completed");
}
