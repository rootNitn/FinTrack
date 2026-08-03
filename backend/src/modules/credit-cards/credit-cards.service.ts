import { CreditCard, CreditCardPayment, CreditCardStatement, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { encrypt } from "../../utils/crypto";
import { CC_DUE_SOON_DAYS } from "./credit-cards.constants";
import {
  computeNextDueDate,
  daysUntil,
  deriveStatementStatus,
  isDueSoon,
  maskCardNumber,
  round2,
  utilizationLevel,
  utilizationPercent,
} from "./credit-cards.util";
import {
  CreateCreditCardInput,
  CreatePaymentInput,
  CreateStatementInput,
  RedeemRewardInput,
  UpdateCreditCardInput,
  UpdateStatementInput,
} from "./credit-cards.dto";

function num(value: Prisma.Decimal | number): number {
  return Number(value);
}

function serializeCard(
  card: CreditCard & { familyMember?: { name: string } | null },
  pendingStatement?: CreditCardStatement | null
) {
  const { cardNumberEncrypted: _enc, cardNumberLast4, familyMember, ...rest } = card;
  const creditLimit = num(card.creditLimit);
  const currentOutstanding = num(card.currentOutstanding);
  const nextDueDate = pendingStatement ? pendingStatement.dueDate : computeNextDueDate(card.statementDay, card.paymentDueDays);
  const daysUntilDue = daysUntil(nextDueDate);
  const pct = utilizationPercent(currentOutstanding, creditLimit);

  return {
    ...rest,
    creditLimit,
    currentOutstanding,
    rewardPointsBalance: num(card.rewardPointsBalance),
    cashbackBalance: num(card.cashbackBalance),
    annualFee: num(card.annualFee),
    interestRatePercent: num(card.interestRatePercent),
    cardNumber: maskCardNumber(cardNumberLast4),
    utilizationPercent: pct,
    utilizationLevel: utilizationLevel(pct),
    nextDueDate,
    daysUntilDue,
    isDueSoon: isDueSoon(daysUntilDue),
    familyMemberName: familyMember?.name ?? null,
  };
}

function serializeStatement(statement: CreditCardStatement) {
  return {
    ...statement,
    totalDue: num(statement.totalDue),
    minimumDue: num(statement.minimumDue),
    paidAmount: num(statement.paidAmount),
    rewardPointsEarned: num(statement.rewardPointsEarned),
    cashbackEarned: num(statement.cashbackEarned),
    daysUntilDue: daysUntil(statement.dueDate),
  };
}

function serializePayment(payment: CreditCardPayment) {
  return { ...payment, amount: num(payment.amount) };
}

async function requireCard(userId: string, cardId: string) {
  const card = await prisma.creditCard.findFirst({
    where: { id: cardId, userId },
    include: { familyMember: { select: { name: true } } },
  });
  if (!card) throw AppError.notFound("Credit card not found");
  return card;
}

export const creditCardsService = {
  async list(userId: string, familyMemberId?: string) {
    const cards = await prisma.creditCard.findMany({
      where: { userId, ...(familyMemberId ? { familyMemberId } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        statements: { where: { status: { not: "PAID" } }, orderBy: { dueDate: "asc" }, take: 1 },
        familyMember: { select: { name: true } },
      },
    });
    return cards.map((card) => serializeCard(card, card.statements[0] ?? null));
  },

  async getById(userId: string, id: string) {
    const card = await requireCard(userId, id);
    const statements = await prisma.creditCardStatement.findMany({
      where: { cardId: id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    const payments = await prisma.creditCardPayment.findMany({ where: { cardId: id }, orderBy: { paidDate: "desc" } });
    const pending = statements
      .filter((s) => s.status !== "PAID")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

    return {
      ...serializeCard(card, pending ?? null),
      statements: statements.map(serializeStatement),
      payments: payments.map(serializePayment),
    };
  },

  async create(userId: string, input: CreateCreditCardInput) {
    const { cardNumber, ...rest } = input;
    const card = await prisma.creditCard.create({
      data: {
        ...rest,
        userId,
        cardNumberEncrypted: encrypt(cardNumber),
        cardNumberLast4: cardNumber.slice(-4),
      },
      include: { familyMember: { select: { name: true } } },
    });
    return serializeCard(card, null);
  },

  async update(userId: string, id: string, input: UpdateCreditCardInput) {
    await requireCard(userId, id);
    const { cardNumber, ...rest } = input;
    const card = await prisma.creditCard.update({
      where: { id },
      data: {
        ...rest,
        ...(cardNumber ? { cardNumberEncrypted: encrypt(cardNumber), cardNumberLast4: cardNumber.slice(-4) } : {}),
      },
      include: { familyMember: { select: { name: true } } },
    });
    return serializeCard(card, null);
  },

  async remove(userId: string, id: string) {
    await requireCard(userId, id);
    await prisma.creditCard.delete({ where: { id } });
  },

  async listStatements(userId: string, cardId: string) {
    await requireCard(userId, cardId);
    const statements = await prisma.creditCardStatement.findMany({
      where: { cardId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return statements.map(serializeStatement);
  },

  async createStatement(userId: string, cardId: string, input: CreateStatementInput) {
    await requireCard(userId, cardId);

    const existing = await prisma.creditCardStatement.findUnique({
      where: { cardId_month_year: { cardId, month: input.month, year: input.year } },
    });
    if (existing) throw AppError.conflict("A statement for this month/year already exists for this card");

    const status = deriveStatementStatus(input.totalDue, 0, input.dueDate);
    const statement = await prisma.creditCardStatement.create({
      data: { ...input, cardId, userId, status },
    });

    await prisma.creditCard.update({
      where: { id: cardId },
      data: {
        rewardPointsBalance: { increment: input.rewardPointsEarned },
        cashbackBalance: { increment: input.cashbackEarned },
      },
    });

    return serializeStatement(statement);
  },

  async updateStatement(userId: string, cardId: string, statementId: string, input: UpdateStatementInput) {
    await requireCard(userId, cardId);
    const statement = await prisma.creditCardStatement.findFirst({ where: { id: statementId, cardId, userId } });
    if (!statement) throw AppError.notFound("Statement not found");

    const rewardDelta = input.rewardPointsEarned !== undefined ? input.rewardPointsEarned - num(statement.rewardPointsEarned) : 0;
    const cashbackDelta = input.cashbackEarned !== undefined ? input.cashbackEarned - num(statement.cashbackEarned) : 0;

    const totalDue = input.totalDue ?? num(statement.totalDue);
    const dueDate = input.dueDate ?? statement.dueDate;
    const paidAmount = num(statement.paidAmount);
    const status = deriveStatementStatus(totalDue, paidAmount, dueDate);

    const updated = await prisma.creditCardStatement.update({
      where: { id: statementId },
      data: { ...input, status },
    });

    if (rewardDelta !== 0 || cashbackDelta !== 0) {
      await prisma.creditCard.update({
        where: { id: cardId },
        data: {
          rewardPointsBalance: { increment: rewardDelta },
          cashbackBalance: { increment: cashbackDelta },
        },
      });
    }

    return serializeStatement(updated);
  },

  async removeStatement(userId: string, cardId: string, statementId: string) {
    await requireCard(userId, cardId);
    const statement = await prisma.creditCardStatement.findFirst({ where: { id: statementId, cardId, userId } });
    if (!statement) throw AppError.notFound("Statement not found");

    await prisma.$transaction([
      prisma.creditCard.update({
        where: { id: cardId },
        data: {
          rewardPointsBalance: { decrement: num(statement.rewardPointsEarned) },
          cashbackBalance: { decrement: num(statement.cashbackEarned) },
        },
      }),
      prisma.creditCardStatement.delete({ where: { id: statementId } }),
    ]);
  },

  async listPayments(userId: string, cardId: string) {
    await requireCard(userId, cardId);
    const payments = await prisma.creditCardPayment.findMany({ where: { cardId }, orderBy: { paidDate: "desc" } });
    return payments.map(serializePayment);
  },

  async recordPayment(userId: string, cardId: string, input: CreatePaymentInput) {
    const card = await requireCard(userId, cardId);

    let statement: CreditCardStatement | null = null;
    if (input.statementId) {
      statement = await prisma.creditCardStatement.findFirst({ where: { id: input.statementId, cardId, userId } });
      if (!statement) throw AppError.notFound("Statement not found");
    }

    const payment = await prisma.creditCardPayment.create({
      data: {
        cardId,
        userId,
        statementId: statement?.id,
        amount: input.amount,
        paidDate: input.paidDate,
        method: input.method,
        notes: input.notes,
      },
    });

    const newOutstanding = Math.max(0, round2(num(card.currentOutstanding) - input.amount));
    await prisma.creditCard.update({ where: { id: cardId }, data: { currentOutstanding: newOutstanding } });

    if (statement) {
      const newPaid = round2(num(statement.paidAmount) + input.amount);
      const status = deriveStatementStatus(num(statement.totalDue), newPaid, statement.dueDate);
      await prisma.creditCardStatement.update({ where: { id: statement.id }, data: { paidAmount: newPaid, status } });
    }

    return serializePayment(payment);
  },

  async redeem(userId: string, cardId: string, input: RedeemRewardInput) {
    const card = await requireCard(userId, cardId);
    const currentBalance = input.type === "POINTS" ? num(card.rewardPointsBalance) : num(card.cashbackBalance);
    if (input.amount > currentBalance) {
      throw AppError.badRequest(`Insufficient ${input.type === "POINTS" ? "reward points" : "cashback"} balance`);
    }

    const updated = await prisma.creditCard.update({
      where: { id: cardId },
      data:
        input.type === "POINTS"
          ? { rewardPointsBalance: { decrement: input.amount } }
          : { cashbackBalance: { decrement: input.amount } },
    });

    return serializeCard(updated, null);
  },

  async summary(userId: string) {
    const cards = await prisma.creditCard.findMany({ where: { userId, isActive: true } });
    const totalLimit = cards.reduce((sum, c) => sum + num(c.creditLimit), 0);
    const totalOutstanding = cards.reduce((sum, c) => sum + num(c.currentOutstanding), 0);
    const totalRewardPoints = cards.reduce((sum, c) => sum + num(c.rewardPointsBalance), 0);
    const totalCashback = cards.reduce((sum, c) => sum + num(c.cashbackBalance), 0);

    const pendingStatements = await prisma.creditCardStatement.findMany({
      where: { userId, status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
      include: { card: true },
    });

    const dueSoon = pendingStatements
      .map((s) => ({ statement: s, daysUntilDue: daysUntil(s.dueDate) }))
      .filter(({ daysUntilDue }) => daysUntilDue <= CC_DUE_SOON_DAYS)
      .map(({ statement: s, daysUntilDue }) => ({
        statementId: s.id,
        cardId: s.cardId,
        cardName: s.card.cardName,
        dueDate: s.dueDate,
        amountDue: round2(num(s.totalDue) - num(s.paidAmount)),
        daysUntilDue,
        status: daysUntilDue < 0 ? "OVERDUE" : s.status,
      }));

    return {
      cardCount: cards.length,
      totalLimit: round2(totalLimit),
      totalOutstanding: round2(totalOutstanding),
      overallUtilizationPercent: utilizationPercent(totalOutstanding, totalLimit),
      totalRewardPoints: round2(totalRewardPoints),
      totalCashback: round2(totalCashback),
      dueSoon,
    };
  },
};
