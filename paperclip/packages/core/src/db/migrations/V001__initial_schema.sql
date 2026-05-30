-- Paperclip Enterprise AI System - Migration V001
-- PostgreSQL 16+

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE agent_status AS ENUM ('idle', 'running', 'error');
CREATE TYPE task_status AS ENUM ('queued', 'assigned', 'running', 'completed', 'failed', 'timed_out');
CREATE TYPE escalation_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE escalation_urgency AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE experience_outcome AS ENUM ('success', 'failure', 'partial');
CREATE TYPE skill_action AS ENUM ('created', 'updated', 'deprecated');
CREATE TYPE threshold_dimension AS ENUM ('budget', 'risk', 'sensitivity', 'authority');
CREATE TYPE timeout_action AS ENUM ('auto_reject');

-- ============================================================
-- Companies
-- ============================================================
CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Departments
-- ============================================================
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_departments_company_id ON departments(company_id);

-- ============================================================
-- Agents (AI Agents)
-- ============================================================
CREATE TABLE agents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  role            TEXT NOT NULL,
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  skills          TEXT[] NOT NULL DEFAULT '{}',
  budget_limit    NUMERIC(18, 2) NOT NULL DEFAULT 0,
  workspace_id    UUID,
  status          agent_status NOT NULL DEFAULT 'idle',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_department_id ON agents(department_id);
CREATE INDEX idx_agents_status ON agents(status);

-- ============================================================
-- Tasks
-- ============================================================
CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  status            task_status NOT NULL DEFAULT 'queued',
  assignee_id       UUID REFERENCES agents(id) ON DELETE SET NULL,
  budget_allocated  NUMERIC(18, 2) NOT NULL DEFAULT 0,
  budget_used       NUMERIC(18, 2) NOT NULL DEFAULT 0,
  priority          INTEGER NOT NULL DEFAULT 5,
  result            JSONB,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_priority ON tasks(priority);

-- ============================================================
-- Approval Thresholds
-- ============================================================
CREATE TABLE approval_thresholds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dimension       threshold_dimension NOT NULL,
  value           NUMERIC(18, 2) NOT NULL,
  timeout_ms      INTEGER NOT NULL,
  timeout_action  timeout_action NOT NULL DEFAULT 'auto_reject',
  scope           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Escalation Requests
-- ============================================================
CREATE TABLE escalation_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  urgency     escalation_urgency NOT NULL DEFAULT 'medium',
  channel     TEXT NOT NULL DEFAULT '',
  status      escalation_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_escalation_requests_task_id ON escalation_requests(task_id);
CREATE INDEX idx_escalation_requests_status ON escalation_requests(status);

-- ============================================================
-- Agent Memories
-- ============================================================
CREATE TABLE agent_memories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_memories_agent_id ON agent_memories(agent_id);

-- ============================================================
-- Agent Skills
-- ============================================================
CREATE TABLE agent_skills (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_id             UUID NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  applicable_contexts   TEXT[] NOT NULL DEFAULT '{}',
  success_rate          NUMERIC(5, 4) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at         TIMESTAMPTZ
);

CREATE INDEX idx_agent_skills_memory_id ON agent_skills(memory_id);

-- ============================================================
-- Experiences
-- ============================================================
CREATE TABLE experiences (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_id   UUID NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  outcome     experience_outcome NOT NULL,
  lessons     TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_experiences_memory_id ON experiences(memory_id);
CREATE INDEX idx_experiences_task_id ON experiences(task_id);

-- Full-text search on lessons
ALTER TABLE experiences ADD COLUMN lessons_tsv TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', array_to_string(lessons, ' '))
  ) STORED;

CREATE INDEX idx_experiences_lessons_fts ON experiences USING GIN (lessons_tsv);

-- ============================================================
-- Workspaces
-- ============================================================
CREATE TABLE workspaces (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            TEXT NOT NULL,
  runtime         TEXT NOT NULL,
  isolation_level TEXT NOT NULL,
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspaces_agent_id ON workspaces(agent_id);

-- ============================================================
-- Budgets
-- ============================================================
CREATE TABLE budgets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  limit       NUMERIC(18, 2) NOT NULL,
  spent       NUMERIC(18, 2) NOT NULL DEFAULT 0,
  remaining   NUMERIC(18, 2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budgets_agent_id ON budgets(agent_id);
CREATE INDEX idx_budgets_task_id ON budgets(task_id);

-- ============================================================
-- Self-Improvement Metrics
-- ============================================================
CREATE TABLE self_improvement_metrics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  cycle_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_self_improvement_metrics_agent_id ON self_improvement_metrics(agent_id);

-- Self-improvement metrics history
CREATE TABLE self_improvement_history (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  self_improvement_id     UUID NOT NULL REFERENCES self_improvement_metrics(id) ON DELETE CASCADE,
  accuracy                NUMERIC(5, 4),
  efficiency              NUMERIC(5, 4),
  task_completion_rate    NUMERIC(5, 4),
  recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_self_improvement_history_si_id ON self_improvement_history(self_improvement_id);

-- Self-improvement skill updates
CREATE TABLE self_improvement_skill_updates (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  self_improvement_id     UUID NOT NULL REFERENCES self_improvement_metrics(id) ON DELETE CASCADE,
  skill_id                UUID REFERENCES agent_skills(id) ON DELETE SET NULL,
  action                  skill_action NOT NULL,
  delta                   JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_si_skill_updates_si_id ON self_improvement_skill_updates(self_improvement_id);
