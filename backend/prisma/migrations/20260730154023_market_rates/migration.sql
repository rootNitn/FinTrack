-- CreateTable
CREATE TABLE "market_rates" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "changeAmount" DECIMAL(14,2) NOT NULL,
    "changePercent" DECIMAL(8,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_rates_symbol_key" ON "market_rates"("symbol");
