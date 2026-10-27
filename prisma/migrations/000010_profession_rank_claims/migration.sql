CREATE TABLE profession_rank_claims (
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    profession TEXT NOT NULL CHECK (profession IN ('creator', 'freelancer', 'driver', 'seller')),
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 7),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, profession, rank)
);

CREATE INDEX profession_rank_claims_player_idx ON profession_rank_claims(player_id);

WITH verified_events AS (
    SELECT c.player_id, 'creator'::TEXT AS profession, c.amount_cents AS amount_cents
    FROM creator_income c
    JOIN paypal_transactions p ON p.player_id = c.player_id
        AND p.routed_record_type = 'income' AND p.routed_record_id = c.id
    WHERE c.status = 'paid' AND c.amount_cents IN (p.gross_cents, p.net_cents)
        AND p.currency = 'USD' AND p.gross_cents > 0 AND p.net_cents >= 0
        AND p.net_cents = p.gross_cents - p.fee_cents
        AND p.kind ~* '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
    UNION ALL
    SELECT g.player_id, 'freelancer', g.gross_cents
    FROM freelance_gigs g
    JOIN paypal_transactions p ON p.player_id = g.player_id
        AND p.routed_record_type = 'gigs' AND p.routed_record_id = g.id
    WHERE g.stage = 'Paid' AND (g.gross_cents = p.gross_cents OR g.gross_cents - g.fee_cents = p.net_cents)
        AND p.currency = 'USD' AND p.gross_cents > 0 AND p.net_cents >= 0
        AND p.net_cents = p.gross_cents - p.fee_cents
        AND p.kind ~* '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
    UNION ALL
    SELECT s.player_id, 'driver', s.pay_cents + s.tips_cents
    FROM delivery_shifts s
    JOIN paypal_transactions p ON p.player_id = s.player_id
        AND p.routed_record_type = 'shifts' AND p.routed_record_id = s.id
    WHERE s.pay_cents + s.tips_cents IN (p.gross_cents, p.net_cents)
        AND p.currency = 'USD' AND p.gross_cents > 0 AND p.net_cents >= 0
        AND p.net_cents = p.gross_cents - p.fee_cents
        AND p.kind ~* '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
    UNION ALL
    SELECT s.player_id, 'seller', s.price_cents
    FROM sales s
    JOIN paypal_transactions p ON p.player_id = s.player_id
        AND p.routed_record_type = 'sales' AND p.routed_record_id = s.id
    WHERE s.status = 'paid' AND (s.price_cents = p.gross_cents OR s.price_cents - s.fee_cents = p.net_cents)
        AND p.currency = 'USD' AND p.gross_cents > 0 AND p.net_cents >= 0
        AND p.net_cents = p.gross_cents - p.fee_cents
        AND p.kind ~* '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
), totals AS (
    SELECT player_id, profession, SUM(amount_cents) AS amount_cents
    FROM verified_events GROUP BY player_id, profession
), thresholds AS (
    SELECT * FROM (VALUES
        (1, 100), (2, 1000), (3, 5000), (4, 10000),
        (5, 25000), (6, 50000), (7, 100000)
    ) AS ranks(rank, threshold_cents)
)
INSERT INTO profession_rank_claims (player_id, profession, rank)
SELECT totals.player_id, totals.profession, thresholds.rank
FROM totals CROSS JOIN thresholds
WHERE totals.amount_cents >= thresholds.threshold_cents;
