-- Preserve every existing claim while allowing each player to earn every rung.
ALTER TABLE "rung_claims" DROP CONSTRAINT "rung_claims_pkey";
ALTER TABLE "rung_claims" ADD CONSTRAINT "rung_claims_pkey" PRIMARY KEY ("player_id", "rung_cents");
