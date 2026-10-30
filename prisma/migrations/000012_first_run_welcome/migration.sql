ALTER TABLE "players"
  ADD COLUMN "welcome_completed_at" TIMESTAMPTZ;

-- Existing accounts have already completed their first visit; show the welcome only
-- to accounts created after this migration is deployed.
UPDATE "players"
SET "welcome_completed_at" = "created_at";
