import { prisma } from "../../config/prisma";

export type UpcomingBillType = "SIP" | "EMI" | "INSURANCE" | "CREDIT_CARD" | "FD_MATURITY";

export interface UpcomingBillItem {
  id: string;
  type: UpcomingBillType;
  title: string;
  dueDate: string;
  amount: number;
  overdue: boolean;
}

/** Projects a monthly recurring day-of-month (e.g. a SIP debit date) forward to its next occurrence on/after `from`. */
function nextMonthlyOccurrence(dayOfMonth: number, from: Date): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), dayOfMonth);
  if (candidate < from) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

/**
 * Aggregates every kind of "money due soon" across the app — SIPs, recurring EMI/insurance
 * expenses, credit card statement due dates, and FD maturities (both the dedicated FdPortfolio
 * table and legacy FIXED_DEPOSIT/BONDS investments) — into one chronologically sorted list.
 * Powers the Upcoming Bills timeline.
 */
export const upcomingBillsService = {
  async getUpcomingBills(userId: string, days: number) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + days);

    const [sipInvestments, recurringExpenses, ccStatements, fdPortfolios, legacyFds] = await Promise.all([
      prisma.investment.findMany({ where: { userId, status: "ACTIVE", sipAmount: { not: null, gt: 0 } } }),
      prisma.expense.findMany({
        where: { userId, isRecurring: true, category: { in: ["EMI", "INSURANCE"] }, nextRecurrenceDate: { not: null } },
      }),
      prisma.creditCardStatement.findMany({
        where: { userId, status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lte: windowEnd } },
        include: { card: true },
      }),
      prisma.fdPortfolio.findMany({ where: { userId, status: "ACTIVE", maturityDate: { lte: windowEnd } } }),
      prisma.investment.findMany({
        where: { userId, status: "ACTIVE", category: { in: ["FIXED_DEPOSIT", "BONDS"] }, maturityDate: { not: null, lte: windowEnd } },
      }),
    ]);

    const items: UpcomingBillItem[] = [];

    for (const inv of sipInvestments) {
      const dueDate = nextMonthlyOccurrence(inv.purchaseDate.getDate(), now);
      if (dueDate > windowEnd) continue;
      items.push({
        id: `SIP:${inv.id}`,
        type: "SIP",
        title: `SIP — ${inv.name}`,
        dueDate: dueDate.toISOString(),
        amount: Number(inv.sipAmount),
        overdue: false,
      });
    }

    for (const exp of recurringExpenses) {
      if (!exp.nextRecurrenceDate || exp.nextRecurrenceDate > windowEnd) continue;
      items.push({
        id: `${exp.category}:${exp.id}`,
        type: exp.category === "EMI" ? "EMI" : "INSURANCE",
        title: exp.description ?? (exp.category === "EMI" ? "EMI payment" : "Insurance premium"),
        dueDate: exp.nextRecurrenceDate.toISOString(),
        amount: Number(exp.amount),
        overdue: exp.nextRecurrenceDate < now,
      });
    }

    for (const stmt of ccStatements) {
      items.push({
        id: `CREDIT_CARD:${stmt.id}`,
        type: "CREDIT_CARD",
        title: `${stmt.card.cardName} statement`,
        dueDate: stmt.dueDate.toISOString(),
        amount: Number(stmt.totalDue) - Number(stmt.paidAmount),
        overdue: stmt.dueDate < now,
      });
    }

    for (const fd of fdPortfolios) {
      items.push({
        id: `FD_MATURITY:${fd.id}`,
        type: "FD_MATURITY",
        title: `${fd.bankName} FD maturity`,
        dueDate: fd.maturityDate.toISOString(),
        amount: Number(fd.maturityAmount),
        overdue: fd.maturityDate < now,
      });
    }

    for (const inv of legacyFds) {
      if (!inv.maturityDate) continue;
      items.push({
        id: `FD_MATURITY:investment:${inv.id}`,
        type: "FD_MATURITY",
        title: `${inv.name} maturity`,
        dueDate: inv.maturityDate.toISOString(),
        amount: Number(inv.currentValue),
        overdue: inv.maturityDate < now,
      });
    }

    items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const totalOutgoing = items
      .filter((item) => item.type !== "FD_MATURITY")
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      windowDays: days,
      items,
      overdueCount: items.filter((item) => item.overdue).length,
      totalOutgoing: Number(totalOutgoing.toFixed(2)),
    };
  },
};
