DROP TABLE ai_cache;
DROP TABLE ai_usage;
DROP TABLE ai_budget;
ALTER TABLE players ADD COLUMN smart_suggestions boolean NOT NULL DEFAULT false;
