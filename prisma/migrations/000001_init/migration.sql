CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paypal_user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "player_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_states" (
    "state" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("state")
);

CREATE TABLE "log_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "worked_on" DATE NOT NULL,
    "note" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "log_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quest_progress" (
    "player_id" UUID NOT NULL,
    "quest_id" TEXT NOT NULL,
    "completed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quest_progress_pkey" PRIMARY KEY ("player_id", "quest_id")
);

CREATE TABLE "rung_claims" (
    "rung_cents" INTEGER NOT NULL,
    "player_id" UUID NOT NULL,
    "claimed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rung_claims_pkey" PRIMARY KEY ("rung_cents")
);

CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "log_entry_id" UUID,
    "status" TEXT NOT NULL,
    "extracted_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "rung_cents" INTEGER NOT NULL,
    "paypal_batch_id" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "players_paypal_user_id_key" ON "players"("paypal_user_id");
CREATE INDEX "sessions_player_id_idx" ON "sessions"("player_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states"("expires_at");
CREATE INDEX "log_entries_player_id_idx" ON "log_entries"("player_id");
CREATE INDEX "log_entries_worked_on_idx" ON "log_entries"("worked_on");
CREATE INDEX "rung_claims_player_id_idx" ON "rung_claims"("player_id");
CREATE INDEX "receipts_player_id_idx" ON "receipts"("player_id");
CREATE INDEX "receipts_log_entry_id_idx" ON "receipts"("log_entry_id");
CREATE INDEX "payouts_player_id_idx" ON "payouts"("player_id");
CREATE INDEX "payouts_rung_cents_idx" ON "payouts"("rung_cents");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rung_claims" ADD CONSTRAINT "rung_claims_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_log_entry_id_fkey" FOREIGN KEY ("log_entry_id") REFERENCES "log_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
