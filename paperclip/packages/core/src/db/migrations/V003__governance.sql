-- Paperclip Governance - Migration V003
-- Adds tables for routines and secrets (governance tables already in V001)

-- ============================================================
-- Routines (scheduled tasks)
-- ============================================================
CREATE TABLE IF NOT EXISTS routines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  cron_expression TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run        TIMESTAMPTZ,
  next_run        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routines_enabled ON routines(enabled);

-- ============================================================
-- Secrets (encrypted API keys, channel tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS secrets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  encrypted  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_name ON secrets(name);
