CREATE TABLE feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    app TEXT NOT NULL CHECK (app IN ('first', 'spotlight', 'freelance', 'market', 'paypal')),
    body VARCHAR(1000) NOT NULL CHECK (char_length(btrim(body)) > 0),
    blocking BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'fixed', 'wontfix')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX feedback_player_id_created_at_idx ON feedback(player_id, created_at);
