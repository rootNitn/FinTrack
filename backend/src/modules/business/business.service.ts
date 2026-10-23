import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateBusinessEntryInput } from "./business.dto";

const round2 = (value: number) => Number(value.toFixed(2));

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export const businessService = {
  async list(userId: string, businessName?: string) {
    return prisma.businessEntry.findMany({
      where: { userId, ...(businessName ? { businessName } : {}) },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  },

  async create(userId: string, input: CreateBusinessEntryInput) {
    return prisma.businessEntry.create({ data: { ...input, userId } });
  },

  async remove(userId: string, id: string) {
    const entry = await prisma.businessEntry.findFirst({ where: { id, userId } });
    if (!entry) throw AppError.notFound("Business entry not found");
    await prisma.businessEntry.delete({ where: { id } });
  },

  async dashboard(userId: string) {
    const entries = await prisma.businessEntry.findMany({ where: { userId }, orderBy: { date: "asc" } });
    const totals = { investment: 0, income: 0, expense: 0 };
    const monthly = new Map<string, { investment: number; income: number; expense: number }>();
    const spending = new Map<string, number>();
    const businesses = new Map<string, { investment: number; income: number; expense: number }>();

    for (const entry of entries) {
      const amount = Number(entry.amount);
      const key = entry.type.toLowerCase() as "investment" | "income" | "expense";
      totals[key] += amount;
      const month = monthly.get(monthKey(entry.date)) ?? { investment: 0, income: 0, expense: 0 };
      month[key] += amount;
      monthly.set(monthKey(entry.date), month);
      const business = businesses.get(entry.businessName) ?? { investment: 0, income: 0, expense: 0 };
      business[key] += amount;
      businesses.set(entry.businessName, business);
      if (entry.type === "EXPENSE") {
        const category = entry.category || "Uncategorised";
        spending.set(category, (spending.get(category) ?? 0) + amount);
      }
    }

    return {
      businesses: Array.from(businesses, ([name, values]) => ({ name, ...values, profit: values.income - values.expense })),
      totals: { ...totals, profit: totals.income - totals.expense },
      monthly: Array.from(monthly, ([label, values]) => ({ label, ...values, profit: values.income - values.expense })),
      spending: Array.from(spending, ([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
      entries: entries.map((entry) => ({ ...entry, amount: Number(entry.amount) })),
    };
  },
};
