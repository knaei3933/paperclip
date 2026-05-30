-- Paperclip Learning Engine - Migration V002
-- Adds columns/tables needed by the learning package

-- Add extended experience fields
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS approach_taken TEXT NOT NULL DEFAULT '';
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS time_taken_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS token_cost NUMERIC(18, 2) NOT NULL DEFAULT 0;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '';
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT '';
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS task_description TEXT NOT NULL DEFAULT '';
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS success_flag BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_experiences_agent_id ON experiences(agent_id);
CREATE INDEX IF NOT EXISTS idx_experiences_department ON experiences(department);
CREATE INDEX IF NOT EXISTS idx_experiences_task_type ON experiences(task_type);

-- Add FTS index on task_description
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS task_description_tsv TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(task_description, '') || ' ' || array_to_string(lessons, ' '))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_experiences_task_description_fts ON experiences USING GIN (task_description_tsv);

-- Extend agent_skills with learning engine fields
ALTER TABLE agent_skills ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_skills ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_skills ADD COLUMN IF NOT EXISTS prompt_template TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_skills ADD COLUMN IF NOT EXISTS tool_sequence TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE agent_skills ADD COLUMN IF NOT EXISTS validation_criteria TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE agent_skills ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_id ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_domain ON agent_skills(domain);

-- Skill application log
CREATE TABLE IF NOT EXISTS skill_applications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id    UUID NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  success     BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_applications_skill_id ON skill_applications(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_applications_agent_id ON skill_applications(agent_id);

-- CEO preference learning
CREATE TABLE IF NOT EXISTS approval_decisions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escalation_id   UUID NOT NULL REFERENCES escalation_requests(id) ON DELETE CASCADE,
  approved        BOOLEAN NOT NULL,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_decisions_escalation_id ON approval_decisions(escalation_id);

-- CEO preference model
CREATE TABLE IF NOT EXISTS preference_models (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patterns    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-improvement metric snapshots (extends existing tables)
-- Additional fields for richer metric tracking
ALTER TABLE self_improvement_history ADD COLUMN IF NOT EXISTS avg_completion_time_ms NUMERIC(18, 2);
ALTER TABLE self_improvement_history ADD COLUMN IF NOT EXISTS cost_efficiency NUMERIC(5, 4);
