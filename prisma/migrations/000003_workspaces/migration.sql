CREATE TABLE brand_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  brand VARCHAR(120) NOT NULL CHECK (length(trim(brand)) > 0),
  platform TEXT NOT NULL CHECK (platform IN ('YouTube','TikTok','Instagram','Facebook','Other')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 0 AND 1000000),
  due_on DATE,
  deliverables VARCHAR(120) NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('Negotiating','Agreed','Delivered','Invoiced','Paid')),
  UNIQUE (id, player_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX brand_deals_player_idx ON brand_deals(player_id);

CREATE TABLE creator_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('YouTube','TikTok','Instagram','Facebook','Other')),
  stream_type TEXT NOT NULL CHECK (stream_type IN ('Ad revenue','Creator rewards','Subscriptions','Gifts and tips','Brand deal','Affiliate','Merch','Other')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 0 AND 1000000),
  earned_on DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','paid')),
  paid_on DATE,
  content_minutes INTEGER NOT NULL CHECK (content_minutes BETWEEN 0 AND 1440),
  note VARCHAR(120) NOT NULL,
  brand_deal_id UUID UNIQUE,
  FOREIGN KEY (brand_deal_id, player_id) REFERENCES brand_deals(id, player_id) ON DELETE SET NULL (brand_deal_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX creator_income_player_idx ON creator_income(player_id);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  app TEXT NOT NULL CHECK (app IN ('spotlight','freelance','market_delivery','market_selling')),
  item VARCHAR(120) NOT NULL CHECK (length(trim(item)) > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 0 AND 1000000),
  spent_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX expenses_player_idx ON expenses(player_id);

CREATE TABLE freelance_gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('Upwork','Fiverr','Freelancer.com','Toptal','Behance','Dribbble','Other')),
  client VARCHAR(120) NOT NULL CHECK (length(trim(client)) > 0),
  project VARCHAR(120) NOT NULL CHECK (length(trim(project)) > 0),
  pricing TEXT NOT NULL CHECK (pricing IN ('fixed','hourly')),
  gross_cents INTEGER NOT NULL CHECK (gross_cents BETWEEN 0 AND 1000000),
  fee_cents INTEGER NOT NULL CHECK (fee_cents BETWEEN 0 AND 1000000),
  hours_x100 INTEGER NOT NULL CHECK (hours_x100 BETWEEN 0 AND 2400),
  started_on DATE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('In progress','Delivered','Clearing','Paid')),
  paid_on DATE,
  CHECK (fee_cents <= gross_cents),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX freelance_gigs_player_idx ON freelance_gigs(player_id);

CREATE TABLE delivery_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('DoorDash','Uber','Uber Eats','Lyft','Instacart','Grubhub','Other')),
  worked_on DATE NOT NULL,
  pay_cents INTEGER NOT NULL CHECK (pay_cents BETWEEN 0 AND 1000000),
  tips_cents INTEGER NOT NULL CHECK (tips_cents BETWEEN 0 AND 1000000),
  minutes_online INTEGER NOT NULL CHECK (minutes_online BETWEEN 0 AND 1440),
  miles_x10 INTEGER NOT NULL CHECK (miles_x10 BETWEEN 0 AND 20000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX delivery_shifts_player_idx ON delivery_shifts(player_id);

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  store TEXT NOT NULL CHECK (store IN ('Amazon','eBay','Etsy','Facebook Marketplace','TikTok Shop','Shopify','Printify Shop','Other')),
  item VARCHAR(120) NOT NULL CHECK (length(trim(item)) > 0),
  sold_on DATE NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 0 AND 1000000),
  fee_cents INTEGER NOT NULL CHECK (fee_cents BETWEEN 0 AND 1000000),
  cost_cents INTEGER NOT NULL CHECK (cost_cents BETWEEN 0 AND 1000000),
  ship_cents INTEGER NOT NULL CHECK (ship_cents BETWEEN 0 AND 1000000),
  made_by TEXT NOT NULL CHECK (made_by IN ('Own stock','Printify','Ninja Transfers','Other')),
  status TEXT NOT NULL CHECK (status IN ('pending','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sales_player_idx ON sales(player_id);
