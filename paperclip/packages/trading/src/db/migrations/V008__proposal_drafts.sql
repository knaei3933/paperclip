CREATE TABLE IF NOT EXISTS proposal_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  manufacturer_id UUID REFERENCES manufacturers(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]',
  manufacturer_specs JSONB,
  margin_rate DECIMAL(5,4),
  exchange_rate DECIMAL(10,4),
  remittance_fee DECIMAL(12,2),
  total_amount_jpy DECIMAL(14,2),
  pdf_path VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
