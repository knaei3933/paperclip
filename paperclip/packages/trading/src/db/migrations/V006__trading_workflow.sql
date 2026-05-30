-- Paperclip Trading - Migration V006
-- Trading workflow tables (deals, templates, documents)

-- Deals
CREATE TABLE deals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  manufacturer_id UUID REFERENCES manufacturers(id),
  stage           deal_stage DEFAULT 'lead',
  amount          NUMERIC,
  probability     SMALLINT DEFAULT 10,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Templates
CREATE TABLE templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  category      TEXT,
  file_path     TEXT,
  content       TEXT,
  placeholders  TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID REFERENCES deals(id),
  template_id     UUID NOT NULL REFERENCES templates(id),
  form_data       JSONB DEFAULT '{}',
  rendered_content TEXT,
  pdf_path        TEXT,
  status          TEXT DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_customer ON deals(customer_id);
CREATE INDEX idx_documents_deal ON documents(deal_id);
CREATE INDEX idx_templates_category ON templates(category);
