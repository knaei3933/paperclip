-- V004: Add pipelines and routines support

-- Pipelines: ordered multi-step workflows
CREATE TABLE IF NOT EXISTS pipelines (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  steps       JSONB NOT NULL DEFAULT '[]',
  current_step INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Routines: add columns for cron-based scheduled tasks (table created in V003)
ALTER TABLE routines ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS task_template JSONB NOT NULL DEFAULT '{}';
ALTER TABLE routines ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '';

-- Agents: add current_task_id for dashboard AgentListItem type
ALTER TABLE agents ADD COLUMN IF NOT EXISTS current_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Add pipeline tracking to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pipeline_step INTEGER;

CREATE INDEX IF NOT EXISTS idx_tasks_pipeline_id ON tasks(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
CREATE INDEX IF NOT EXISTS idx_routines_enabled ON routines(enabled);
