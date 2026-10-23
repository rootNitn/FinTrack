import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { adjustBankAccountBalance } from "../utils/bank-account-balance.util";
import { addRecurrenceInterval } from "../utils/recurrence.util";

/**
 * Generates the next occurrence for every recurring income template whose
 * `nextRecurrenceDate` has arrived, then advances the template to the following date.
 * Stops (clears nextRecurrenceDate) once past the optional recurrenceEndDate.
 */
export async function runRecurringIncomeGeneration() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const due = await prisma.income.findMany({
    where: { isRecurring: true, nextRecurrenceDate: { lte: today } },
  });

  let created = 0;
  for (const template of due) {
    if (!template.recurrenceInterval || !template.nextRecurrenceDate) continue;

    const occurrenceDate = template.nextRecurrenceDate;
    const upcoming = addRecurrenceInterval(occurrenceDate, template.recurrenceInterval);
    const stopped = template.recurrenceEndDate ? upcoming > template.recurrenceEndDate : false;

    await prisma.$transaction(async (tx) => {
      const generated = await tx.income.create({
        data: {
          userId: template.userId,
          date: occurrenceDate,
          source: template.source,
          amount: template.amount,
          description: template.description,
          bankAccountId: template.bankAccountId,
          familyMemberId: template.familyMemberId,
          parentIncomeId: template.id,
          isRecurring: false,
        },
      });

      await tx.transaction.create({
        data: {
          userId: template.userId,
          type: "INCOME",
          sourceType: "INCOME",
          sourceId: generated.id,
          amount: template.amount,
          date: occurrenceDate,
          description: template.description ?? `${template.source} income`,
          category: template.source,
          bankAccountId: template.bankAccountId,
          familyMemberId: template.familyMemberId,
        },
      });

      await adjustBankAccountBalance(tx, template.bankAccountId, Number(template.amount));

      await tx.income.update({
        where: { id: template.id },
        data: { nextRecurrenceDate: stopped ? null : upcoming },
      });

      created += 1;
    });
  }

  logger.info({ created }, "Recurring income generation completed");
}
