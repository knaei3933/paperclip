-- V009: Agent capabilities, adapter config, skill-based routing, routine-agent binding

-- agents: capabilities and adapter configuration
ALTER TABLE agents ADD COLUMN IF NOT EXISTS capabilities TEXT NOT NULL DEFAULT '';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS adapter_type TEXT NOT NULL DEFAULT 'claude-code';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS adapter_config JSONB NOT NULL DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS proactive_routines JSONB NOT NULL DEFAULT '[]';

-- tasks: skill-based routing
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS required_skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT '';

-- routines: bind to agent
ALTER TABLE routines ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- Cleanup dead column from V003 (replaced by 'schedule' in V004)
ALTER TABLE routines DROP COLUMN IF EXISTS cron_expression;

-- Backfill existing agents
UPDATE agents SET capabilities = 'Set direction, approve proposals, manage budget allocation for the trading company.', adapter_type = 'claude-code' WHERE role = 'CEO' AND capabilities = '';
UPDATE agents SET adapter_type = 'claude-code' WHERE adapter_type = '' OR adapter_type IS NULL;
