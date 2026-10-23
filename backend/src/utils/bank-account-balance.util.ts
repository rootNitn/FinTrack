import { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * Applies `delta` to a bank account's stored `balance` inside a transaction. Positive delta
 * increases the balance (e.g. income), negative decreases it (e.g. expense). No-op when
 * `bankAccountId` is null/undefined or delta is 0 — linking an expense/income to a bank account
 * is optional, so most rows won't touch this at all.
 */
export async function adjustBankAccountBalance(
  tx: TxClient,
  bankAccountId: string | null | undefined,
  delta: number
): Promise<void> {
  if (!bankAccountId || delta === 0) return;
  await tx.bankAccount.update({
    where: { id: bankAccountId },
    data: { balance: { increment: delta } },
  });
}
