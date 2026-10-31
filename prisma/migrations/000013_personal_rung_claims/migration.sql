-- Preserve every existing claim while allowing each player to earn every rung.
ALTER TABLE "rung_claims" DROP CONSTRAINT "rung_claims_pkey";
ALTER TABLE "rung_claims" ADD CONSTRAINT "rung_claims_pkey" PRIMARY KEY ("player_id", "rung_cents");

-- Give returning players the personal checks their existing matched totals earned.
INSERT INTO "rung_claims" ("player_id", "rung_cents", "claimed_at")
SELECT p."id", r."rung_cents", CURRENT_TIMESTAMP
FROM "players" p
CROSS JOIN (VALUES (10), (100), (1000), (5000), (10000), (25000), (50000), (100000)) AS r("rung_cents")
WHERE (
  SELECT COALESCE(SUM(e."amount_cents"), 0)
  FROM "log_entries" e
  WHERE e."player_id" = p."id" AND e."verified" = true
) >= r."rung_cents"
ON CONFLICT ("player_id", "rung_cents") DO NOTHING;

-- Keep the existing disabled payout references aligned with the personal claims.
INSERT INTO "payouts" ("id", "player_id", "rung_cents", "amount_cents", "sender_batch_id", "status", "created_at")
SELECT gen_random_uuid(), c."player_id", c."rung_cents",
  GREATEST(10, FLOOR(c."rung_cents" / 10.0)::int),
  c."player_id"::text || ':' || c."rung_cents"::text, 'ready', CURRENT_TIMESTAMP
FROM "rung_claims" c
ON CONFLICT ("player_id", "rung_cents") DO NOTHING;
