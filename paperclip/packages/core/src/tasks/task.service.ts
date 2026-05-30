import type { Task, TaskStatus, AIAgent } from '@paperclip/shared-types';
import type { Pool } from 'pg';
import {
  validateTransition,
  InvalidTransitionError,
} from './task-state-machine.js';

export interface DbPool {
  pool: Pool;
}

export interface TaskFilters {
  status?: TaskStatus;
  assigneeId?: string;
  priority?: number;
  limit?: number;
  offset?: number;
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as TaskStatus,
    assigneeId: (row.assignee_id as string) ?? '',
    budgetAllocated: Number(row.budget_allocated),
    budgetUsed: Number(row.budget_used),
    priority: row.priority as number,
    result: row.result,
    retryCount: row.retry_count as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function createTask(
  db: DbPool,
  input: {
    title: string;
    description?: string;
    priority?: number;
    budgetAllocated?: number;
    assigneeId?: string;
  },
): Promise<Task> {
  const { pool } = db;
  const status: TaskStatus = input.assigneeId ? 'assigned' : 'queued';
  const result = await pool.query(
    `INSERT INTO tasks (title, description, status, assignee_id, budget_allocated, priority)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.title,
      input.description ?? '',
      status,
      input.assigneeId ?? null,
      input.budgetAllocated ?? 0,
      input.priority ?? 5,
    ],
  );
  return rowToTask(result.rows[0]);
}

export async function assignTask(
  db: DbPool,
  taskId: string,
  agentId: string,
): Promise<Task> {
  const { pool } = db;
  const current = await pool.query(
    `SELECT status FROM tasks WHERE id = $1`,
    [taskId],
  );
  if (current.rows.length === 0) {
    throw new Error(`Task not found: ${taskId}`);
  }
  const currentStatus = current.rows[0].status as TaskStatus;
  const newStatus: TaskStatus = currentStatus === 'queued' ? 'assigned' : currentStatus;
  if (currentStatus === 'queued') {
    validateTransition(currentStatus, 'assigned');
  }

  const result = await pool.query(
    `UPDATE tasks SET assignee_id = $1, status = $2, updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [agentId, newStatus, taskId],
  );
  return rowToTask(result.rows[0]);
}

export async function transitionStatus(
  db: DbPool,
  taskId: string,
  newStatus: TaskStatus,
): Promise<Task> {
  const { pool } = db;
  const current = await pool.query(
    `SELECT status FROM tasks WHERE id = $1`,
    [taskId],
  );
  if (current.rows.length === 0) {
    throw new Error(`Task not found: ${taskId}`);
  }
  const currentStatus = current.rows[0].status as TaskStatus;
  validateTransition(currentStatus, newStatus);

  const result = await pool.query(
    `UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [newStatus, taskId],
  );
  return rowToTask(result.rows[0]);
}

export async function getTasks(
  db: DbPool,
  filters: TaskFilters = {},
): Promise<Task[]> {
  const { pool } = db;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters.status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(filters.status);
  }
  if (filters.assigneeId) {
    conditions.push(`assignee_id = $${paramIdx++}`);
    params.push(filters.assigneeId);
  }
  if (filters.priority !== undefined) {
    conditions.push(`priority = $${paramIdx++}`);
    params.push(filters.priority);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const result = await pool.query(
    `SELECT * FROM tasks ${where} ORDER BY priority DESC, created_at ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset],
  );
  return result.rows.map(rowToTask);
}

export async function getTaskById(
  db: DbPool,
  taskId: string,
): Promise<Task | null> {
  const { pool } = db;
  const result = await pool.query(
    `SELECT * FROM tasks WHERE id = $1`,
    [taskId],
  );
  if (result.rows.length === 0) return null;
  return rowToTask(result.rows[0]);
}
