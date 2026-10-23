import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { addRecurrenceInterval } from "../utils/recurrence.util";

/**
 * Generates the next occurrence for every recurring investment template (e.g. a monthly SIP-style
 * auto-buy) whose `nextRecurrenceDate` has arrived, then advances the template to the following
 * date. Each generated occurrence is a fresh ACTIVE investment (currentValue = principalAmount,
 * no gains yet) linked back to the template via `parentInvestmentId`, with a matching
 * INVESTMENT_BUY transaction and goal contribution — mirroring what a manual create() does.
 * Stops (clears nextRecurrenceDate) once past the optional recurrenceEndDate.
 */
export async function runRecurringInvestmentGeneration() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const due = await prisma.investment.findMany({
    where: { isRecurring: true, nextRecurrenceDate: { lte: today } },
  });

  let created = 0;
  for (const template of due) {
    if (!template.recurrenceInterval || !template.nextRecurrenceDate) continue;

    const occurrenceDate = template.nextRecurrenceDate;
    const upcoming = addRecurrenceInterval(occurrenceDate, template.recurrenceInterval);
    const stopped = template.recurrenceEndDate ? upcoming > template.recurrenceEndDate : false;

    await prisma.$transaction(async (tx) => {
      const generated = await tx.investment.create({
        data: {
          userId: template.userId,
          name: template.name,
          category: template.category,
          account: template.account,
          principalAmount: template.principalAmount,
          currentValue: template.principalAmount,
          purchaseDate: occurrenceDate,
          riskLevel: template.riskLevel,
          notes: template.notes,
          status: "ACTIVE",
          goalId: template.goalId,
          currency: template.currency,
          exchangeRate: template.exchangeRate,
          familyMemberId: template.familyMemberId,
          parentInvestmentId: template.id,
          isRecurring: false,
        },
      });

      await tx.transaction.create({
        data: {
          userId: template.userId,
          type: "INVESTMENT_BUY",
          amount: template.principalAmount,
          date: occurrenceDate,
          description: `Purchased ${template.name} (auto-recurring)`,
          category: template.category,
          relatedInvestmentId: generated.id,
          familyMemberId: template.familyMemberId,
        },
      });

      if (template.goalId) {
        await tx.goal.update({ where: { id: template.goalId }, data: { currentAmount: { increment: template.principalAmount } } });
      }

      await tx.investment.update({
        where: { id: template.id },
        data: { nextRecurrenceDate: stopped ? null : upcoming },
      });

      created += 1;
    });
  }

  logger.info({ created }, "Recurring investment generation completed");
}
