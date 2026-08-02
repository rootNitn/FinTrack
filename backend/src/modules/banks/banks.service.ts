import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { encrypt, maskAccountNumber } from "../../utils/crypto";
import { CreateBankAccountInput, UpdateBankAccountInput } from "./banks.dto";

function serializeBankAccount<T extends Record<string, unknown>>(account: T) {
  const { accountNumberEncrypted: _enc, accountNumberLast4, ...rest } = account;
  return {
    ...rest,
    balance: Number(account.balance as Prisma.Decimal),
    accountNumber: maskAccountNumber(accountNumberLast4 as string),
  };
}

export const banksService = {
  async list(userId: string) {
    const accounts = await prisma.bankAccount.findMany({ where: { userId }, orderBy: { lastUpdated: "desc" } });
    return accounts.map(serializeBankAccount);
  },

  async getById(userId: string, id: string) {
    const account = await prisma.bankAccount.findFirst({ where: { id, userId } });
    if (!account) throw AppError.notFound("Bank account not found");
    return serializeBankAccount(account);
  },

  async create(userId: string, input: CreateBankAccountInput) {
    const { accountNumber, ...rest } = input;
    const account = await prisma.bankAccount.create({
      data: {
        ...rest,
        userId,
        accountNumberEncrypted: encrypt(accountNumber),
        accountNumberLast4: accountNumber.slice(-4),
      },
    });
    return serializeBankAccount(account);
  },

  async update(userId: string, id: string, input: UpdateBankAccountInput) {
    const existing = await prisma.bankAccount.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Bank account not found");

    const { accountNumber, ...rest } = input;
    const account = await prisma.bankAccount.update({
      where: { id },
      data: {
        ...rest,
        lastUpdated: new Date(),
        ...(accountNumber
          ? { accountNumberEncrypted: encrypt(accountNumber), accountNumberLast4: accountNumber.slice(-4) }
          : {}),
      },
    });
    return serializeBankAccount(account);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.bankAccount.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Bank account not found");
    await prisma.bankAccount.delete({ where: { id } });
  },
};
