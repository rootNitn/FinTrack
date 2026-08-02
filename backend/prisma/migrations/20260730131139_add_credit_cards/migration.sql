-- CreateEnum
CREATE TYPE "CardNetwork" AS ENUM ('VISA', 'MASTERCARD', 'RUPAY', 'AMEX', 'DINERS', 'OTHER');

-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CC_PAYMENT_DUE';

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "network" "CardNetwork" NOT NULL DEFAULT 'OTHER',
    "cardNumberEncrypted" TEXT NOT NULL,
    "cardNumberLast4" TEXT NOT NULL,
    "creditLimit" DECIMAL(14,2) NOT NULL,
    "currentOutstanding" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "statementDay" INTEGER NOT NULL,
    "paymentDueDays" INTEGER NOT NULL DEFAULT 20,
    "rewardPointsBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cashbackBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "annualFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interestRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 3.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_statements" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalDue" DECIMAL(14,2) NOT NULL,
    "minimumDue" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rewardPointsEarned" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cashbackEarned" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "StatementStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_payments" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "statementId" TEXT,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidDate" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_card_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_cards_userId_idx" ON "credit_cards"("userId");

-- CreateIndex
CREATE INDEX "credit_card_statements_userId_idx" ON "credit_card_statements"("userId");

-- CreateIndex
CREATE INDEX "credit_card_statements_cardId_idx" ON "credit_card_statements"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_card_statements_cardId_month_year_key" ON "credit_card_statements"("cardId", "month", "year");

-- CreateIndex
CREATE INDEX "credit_card_payments_userId_idx" ON "credit_card_payments"("userId");

-- CreateIndex
CREATE INDEX "credit_card_payments_cardId_idx" ON "credit_card_payments"("cardId");

-- CreateIndex
CREATE INDEX "credit_card_payments_statementId_idx" ON "credit_card_payments"("statementId");

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_statements" ADD CONSTRAINT "credit_card_statements_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_statements" ADD CONSTRAINT "credit_card_statements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_payments" ADD CONSTRAINT "credit_card_payments_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_payments" ADD CONSTRAINT "credit_card_payments_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "credit_card_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_payments" ADD CONSTRAINT "credit_card_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
