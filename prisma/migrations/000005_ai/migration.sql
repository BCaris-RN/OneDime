CREATE TABLE ai_budget (
  month VARCHAR(7) PRIMARY KEY,
  reserved_cents INTEGER NOT NULL DEFAULT 0 CHECK (reserved_cents >= 0)
);
CREATE TABLE ai_usage (
  request_id UUID PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,
  reserved_cents INTEGER NOT NULL CHECK (reserved_cents > 0),
  cost_cents INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  status TEXT NOT NULL CHECK (status IN ('reserved','complete','failed','invalid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_player_idx ON ai_usage(player_id);
CREATE TABLE ai_cache (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  payer_hash VARCHAR(64) NOT NULL,
  model VARCHAR(120) NOT NULL,
  request_id UUID NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending','complete')),
  payload JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id,payer_hash,model)
);
