import { prisma } from "../../config/prisma";
import { addRecurrenceInterval, nextMonthlyOccurrence } from "../../utils/recurrence.util";

export type UpcomingBillType = "SIP" | "EMI" | "INSURANCE" | "CREDIT_CARD" | "FD_MATURITY";

export interface UpcomingBillItem {
  id: string;
  type: UpcomingBillType;
  title: string;
  dueDate: string;
  amount: number;
  overdue: boolean;
  daysRemaining: number;
  canAct: boolean;
}


/**
 * Aggregates every kind of "money due soon" across the app — SIPs, recurring EMI/insurance
 * expenses, credit card statement due dates, and FD maturities (both the dedicated FdPortfolio
 * table and legacy FIXED_DEPOSIT/BONDS investments) — into one chronologically sorted list.
 * Powers the Upcoming Bills timeline.
 */
export const upcomingBillsService = {
  async updateBill(userId: string, billId: string, action: "paid" | "snooze", value?: Date) {
    const [type, id] = billId.split(":");
    if (!type || !id) throw new Error("Invalid bill id");
    if (type === "EMI" || type === "INSURANCE") {
      const expense = await prisma.expense.findFirst({ where: { id, userId, category: type } });
      if (!expense) throw new Error("Bill not found");
      if (action === "paid" && expense.isRecurring && expense.recurrenceInterval && expense.nextRecurrenceDate) {
        return prisma.expense.update({
          where: { id },
          data: { nextRecurrenceDate: addRecurrenceInterval(expense.nextRecurrenceDate, expense.recurrenceInterval) },
        });
      }
      return prisma.expense.update({ where: { id }, data: action === "paid" ? { paidDate: value ?? new Date() } : { snoozedUntil: value } });
    }
    if (type === "CREDIT_CARD") {
      const statement = await prisma.creditCardStatement.findFirst({ where: { id, userId } });
      if (!statement) throw new Error("Bill not found");
      if (action === "paid") {
        return prisma.creditCardStatement.update({ where: { id }, data: { paidAmount: statement.totalDue, status: "PAID" } });
      }
      return prisma.creditCardStatement.update({ where: { id }, data: { snoozedUntil: value } });
    }
    throw new Error("This bill cannot be updated");
  },
  async getUpcomingBills(userId: string, days: number) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + days);

    const [sipInvestments, recurringExpenses, ccStatements, fdPortfolios, legacyFds] = await Promise.all([
      prisma.investment.findMany({ where: { userId, status: "ACTIVE", sipAmount: { not: null, gt: 0 } } }),
      prisma.expense.findMany({
        where: { userId, isRecurring: true, category: { in: ["EMI", "INSURANCE"] }, nextRecurrenceDate: { not: null }, paidDate: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] },
      }),
      prisma.creditCardStatement.findMany({
        where: { userId, status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lte: windowEnd }, OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] },
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
        daysRemaining: Math.ceil((dueDate.getTime() - now.getTime()) / 86400000),
        canAct: false,
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
        daysRemaining: Math.ceil((exp.nextRecurrenceDate.getTime() - now.getTime()) / 86400000),
        canAct: true,
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
        daysRemaining: Math.ceil((stmt.dueDate.getTime() - now.getTime()) / 86400000),
        canAct: true,
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
        daysRemaining: Math.ceil((fd.maturityDate.getTime() - now.getTime()) / 86400000),
        canAct: false,
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
        daysRemaining: Math.ceil((inv.maturityDate.getTime() - now.getTime()) / 86400000),
        canAct: false,
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
