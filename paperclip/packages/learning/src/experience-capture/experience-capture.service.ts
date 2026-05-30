import type { Pool } from 'pg';
import type { EventBus, ExperienceCaptured } from '@paperclip/shared-types';

export interface DbPool {
  pool: Pool;
}

export interface ExperienceRecord {
  id: string;
  taskId: string;
  agentId: string;
  taskDescription: string;
  approachTaken: string;
  result: unknown;
  success: boolean;
  timeTakenMs: number;
  tokenCost: number;
  department: string;
  taskType: string;
  lessons: string[];
  createdAt: Date;
}

export interface CaptureExperienceInput {
  taskId: string;
  agentId: string;
  taskDescription: string;
  approachTaken: string;
  result: unknown;
  success: boolean;
  timeTakenMs: number;
  tokenCost: number;
  department: string;
  taskType: string;
  lessons?: string[];
}

export interface ExperienceFilters {
  success?: boolean;
  department?: string;
  taskType?: string;
  limit?: number;
  offset?: number;
}

function rowToExperience(row: Record<string, unknown>): ExperienceRecord {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    agentId: row.agent_id as string,
    taskDescription: row.task_description as string,
    approachTaken: row.approach_taken as string,
    result: row.result,
    success: Boolean(row.success),
    timeTakenMs: row.time_taken_ms as number,
    tokenCost: Number(row.token_cost),
    department: row.department as string,
    taskType: row.task_type as string,
    lessons: row.lessons as string[] ?? [],
    createdAt: new Date(row.created_at as string),
  };
}

export async function captureExperience(
  db: DbPool,
  eventBus: EventBus,
  input: CaptureExperienceInput,
): Promise<ExperienceRecord> {
  const { pool } = db;

  // Ensure agent has a memory record
  let memoryId: string | null = null;
  const memResult = await pool.query(
    `SELECT id FROM agent_memories WHERE agent_id = $1 LIMIT 1`,
    [input.agentId],
  );
  if (memResult.rows.length > 0) {
    memoryId = memResult.rows[0].id;
  } else {
    const insertMem = await pool.query(
      `INSERT INTO agent_memories (agent_id) VALUES ($1) RETURNING id`,
      [input.agentId],
    );
    memoryId = insertMem.rows[0].id;
  }

  const successOutcome = input.success ? 'success' : 'failure';
  const lessons = input.lessons ?? (input.success
    ? [`Approach "${input.approachTaken}" succeeded for ${input.taskType}`]
    : [`Approach "${input.approachTaken}" failed for ${input.taskType}`]);

  const result = await pool.query(
    `INSERT INTO experiences
       (memory_id, task_id, agent_id, outcome, lessons, approach_taken, time_taken_ms, token_cost,
        department, task_type, task_description, success_flag)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      memoryId,
      input.taskId,
      input.agentId,
      successOutcome,
      lessons,
      input.approachTaken,
      input.timeTakenMs,
      input.tokenCost,
      input.department,
      input.taskType,
      input.taskDescription,
      input.success,
    ],
  );

  const record = rowToExperience(result.rows[0]);

  eventBus.emit({
    type: 'ExperienceCaptured',
    payload: {
      experienceId: record.id,
      agentId: record.agentId,
      taskId: record.taskId,
    },
    timestamp: new Date(),
    correlationId: record.taskId,
  });

  return record;
}

export async function getExperiences(
  db: DbPool,
  agentId: string,
  filters: ExperienceFilters = {},
): Promise<ExperienceRecord[]> {
  const { pool } = db;
  const conditions: string[] = ['agent_id = $1'];
  const params: unknown[] = [agentId];
  let paramIdx = 2;

  if (filters.success !== undefined) {
    conditions.push(`success_flag = $${paramIdx++}`);
    params.push(filters.success);
  }
  if (filters.department) {
    conditions.push(`department = $${paramIdx++}`);
    params.push(filters.department);
  }
  if (filters.taskType) {
    conditions.push(`task_type = $${paramIdx++}`);
    params.push(filters.taskType);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const result = await pool.query(
    `SELECT * FROM experiences ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset],
  );

  return result.rows.map(rowToExperience);
}

export async function getExperienceCount(
  db: DbPool,
  agentId: string,
): Promise<number> {
  const { pool } = db;
  const result = await pool.query(
    `SELECT COUNT(*)::int as count FROM experiences WHERE agent_id = $1`,
    [agentId],
  );
  return result.rows[0].count;
}
