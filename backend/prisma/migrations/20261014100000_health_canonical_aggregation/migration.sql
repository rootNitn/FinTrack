ALTER TABLE "health_connections"
ADD COLUMN "primarySources" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "health_imported_records"
ADD COLUMN "rawData" JSONB;

ALTER TABLE "health_daily_summaries"
ADD COLUMN "aggregationVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "provenance" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "nativeReference" JSONB;

UPDATE "health_daily_summaries"
SET "nativeReference" = jsonb_strip_nulls(jsonb_build_object(
  'steps', "steps",
  'sleepMinutes', "sleepMinutes",
  'exerciseMinutes', "exerciseMinutes",
  'weightKg', "weightKg",
  'averageHeartRate', "averageHeartRate",
  'source', 'LEGACY_DEVICE_AGGREGATE'
))
WHERE "steps" IS NOT NULL
   OR "sleepMinutes" IS NOT NULL
   OR "exerciseMinutes" IS NOT NULL
   OR "weightKg" IS NOT NULL
   OR "averageHeartRate" IS NOT NULL;

UPDATE "health_daily_summaries"
SET "steps" = NULL,
    "sleepMinutes" = NULL,
    "exerciseMinutes" = NULL,
    "weightKg" = NULL,
    "averageHeartRate" = NULL,
    "aggregationVersion" = 1,
    "provenance" = '{"migration":"legacy_device_totals_preserved_as_reference"}'::jsonb;