-- Paperclip Trading - Migration V005
-- Kanei Trading master data tables

-- Enums
CREATE TYPE deal_stage AS ENUM ('lead','qualified','proposal','negotiation','contract','delivery','installation','complete','as');

-- ============================================================
-- Customers
-- ============================================================
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  name_kana     TEXT,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  industry      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Manufacturers
-- ============================================================
CREATE TABLE manufacturers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  name_korean           TEXT,
  country               TEXT NOT NULL DEFAULT 'KR',
  tier                  SMALLINT NOT NULL DEFAULT 2,
  contact_email         TEXT,
  contact_phone         TEXT,
  website               TEXT,
  equipment_categories  TEXT[] NOT NULL DEFAULT '{}',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_manufacturers_tier ON manufacturers(tier);

-- ============================================================
-- Equipment Categories
-- ============================================================
CREATE TABLE equipment_categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  name_ja       TEXT,
  name_ko       TEXT,
  priority      SMALLINT,
  parent_id     UUID REFERENCES equipment_categories(id),
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Equipment
-- ============================================================
CREATE TABLE equipment (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  name_ja         TEXT,
  manufacturer_id UUID REFERENCES manufacturers(id),
  category_id     UUID REFERENCES equipment_categories(id),
  specs           JSONB NOT NULL DEFAULT '{}',
  price_range     TEXT,
  lead_time       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_manufacturer ON equipment(manufacturer_id);
CREATE INDEX idx_equipment_category ON equipment(category_id);
