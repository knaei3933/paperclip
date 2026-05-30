import type { Pool } from 'pg';

export interface PipelineStep {
  task_template: { title: string; description: string; priority?: number; budget?: number };
  department?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  steps: PipelineStep[];
  current_step: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePipelineInput {
  name: string;
  steps: PipelineStep[];
}

export async function createPipeline(pool: Pool, input: CreatePipelineInput): Promise<Pipeline> {
  const result = await pool.query(
    `INSERT INTO pipelines (name, steps, current_step, status) VALUES ($1, $2, 0, 'pending') RETURNING *`,
    [input.name, JSON.stringify(input.steps)],
  );
  return result.rows[0];
}

export async function getPipeline(pool: Pool, id: string): Promise<Pipeline | null> {
  const result = await pool.query('SELECT * FROM pipelines WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function listPipelines(pool: Pool): Promise<Pipeline[]> {
  const result = await pool.query('SELECT * FROM pipelines ORDER BY created_at DESC');
  return result.rows;
}

export async function advancePipeline(
  pool: Pool,
  pipelineId: string,
  _completedTaskId: string,
): Promise<{ advanced: boolean; nextTaskId?: string }> {
  const pipeline = await getPipeline(pool, pipelineId);
  if (!pipeline) return { advanced: false };

  const steps = Array.isArray(pipeline.steps) ? pipeline.steps : [];
  const nextStepIndex = pipeline.current_step + 1;

  if (nextStepIndex >= steps.length) {
    // Pipeline complete
    await pool.query(
      `UPDATE pipelines SET status = 'completed', current_step = $1, updated_at = now() WHERE id = $2`,
      [nextStepIndex - 1, pipelineId],
    );
    return { advanced: true };
  }

  // Create next task
  const nextStep = steps[nextStepIndex];
  const taskResult = await pool.query(
    `INSERT INTO tasks (id, title, description, status, priority, budget_allocated, budget_used, retry_count, pipeline_id, pipeline_step, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'queued', $3, $4, 0, 0, $5, $6, NOW(), NOW()) RETURNING *`,
    [
      nextStep.task_template.title,
      nextStep.task_template.description,
      nextStep.task_template.priority ?? 5,
      nextStep.task_template.budget ?? 10,
      pipelineId,
      nextStepIndex,
    ],
  );

  await pool.query(
    `UPDATE pipelines SET current_step = $1, status = 'running', updated_at = now() WHERE id = $2`,
    [nextStepIndex, pipelineId],
  );

  return { advanced: true, nextTaskId: taskResult.rows[0].id };
}

export async function failPipeline(pool: Pool, pipelineId: string): Promise<void> {
  await pool.query(
    `UPDATE pipelines SET status = 'failed', updated_at = now() WHERE id = $1`,
    [pipelineId],
  );
}
