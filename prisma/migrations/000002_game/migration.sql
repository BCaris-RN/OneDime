ALTER TABLE "players"
  ADD COLUMN "leaderboard_opt_in" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "time_zone" TEXT,
  ADD COLUMN "clock_platform" TEXT,
  ADD COLUMN "clock_started_at" TIMESTAMPTZ;

ALTER TABLE "players" ADD CONSTRAINT "players_clock_pair"
  CHECK (("clock_platform" IS NULL) = ("clock_started_at" IS NULL));
