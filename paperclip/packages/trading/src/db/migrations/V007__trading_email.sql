-- Paperclip Trading - Migration V007
-- Email integration tables

-- Emails
CREATE TABLE emails (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id       UUID REFERENCES deals(id),
  direction     TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject       TEXT,
  body          TEXT,
  from_addr     TEXT NOT NULL,
  to_addr       TEXT NOT NULL,
  attachments   JSONB DEFAULT '[]',
  message_id    TEXT,
  received_at   TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_emails_deal ON emails(deal_id);
CREATE INDEX idx_emails_from ON emails(from_addr);
CREATE INDEX idx_emails_to ON emails(to_addr);
