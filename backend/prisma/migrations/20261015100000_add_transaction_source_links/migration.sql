CREATE TYPE "TransactionSourceType" AS ENUM ('EXPENSE', 'INCOME');

ALTER TABLE "transactions"
ADD COLUMN "sourceType" "TransactionSourceType",
ADD COLUMN "sourceId" TEXT;

WITH candidates AS (
  SELECT
    t."id" AS transaction_id,
    e."id" AS source_id,
    COUNT(*) OVER (PARTITION BY t."id") AS transaction_matches,
    COUNT(*) OVER (PARTITION BY e."id") AS source_matches
  FROM "transactions" t
  JOIN "expenses" e
    ON e."userId" = t."userId"
    AND e."date" = t."date"
    AND e."amount" = t."amount"
    AND e."category"::text = t."category"
    AND e."bankAccountId" IS NOT DISTINCT FROM t."bankAccountId"
    AND e."familyMemberId" IS NOT DISTINCT FROM t."familyMemberId"
  WHERE t."type" = 'EXPENSE'
)
UPDATE "transactions" t
SET "sourceType" = 'EXPENSE', "sourceId" = c.source_id
FROM candidates c
WHERE t."id" = c.transaction_id
  AND c.transaction_matches = 1
  AND c.source_matches = 1;

WITH candidates AS (
  SELECT
    t."id" AS transaction_id,
    i."id" AS source_id,
    COUNT(*) OVER (PARTITION BY t."id") AS transaction_matches,
    COUNT(*) OVER (PARTITION BY i."id") AS source_matches
  FROM "transactions" t
  JOIN "income" i
    ON i."userId" = t."userId"
    AND i."date" = t."date"
    AND i."amount" = t."amount"
    AND i."source"::text = t."category"
    AND i."bankAccountId" IS NOT DISTINCT FROM t."bankAccountId"
    AND i."familyMemberId" IS NOT DISTINCT FROM t."familyMemberId"
  WHERE t."type" = 'INCOME'
)
UPDATE "transactions" t
SET "sourceType" = 'INCOME', "sourceId" = c.source_id
FROM candidates c
WHERE t."id" = c.transaction_id
  AND c.transaction_matches = 1
  AND c.source_matches = 1;

CREATE UNIQUE INDEX "transactions_sourceType_sourceId_key"
ON "transactions"("sourceType", "sourceId");