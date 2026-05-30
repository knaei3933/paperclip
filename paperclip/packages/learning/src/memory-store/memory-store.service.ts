import type { Pool } from 'pg';
import type { ExperienceRecord } from '../experience-capture/experience-capture.service.js';

export interface DbPool {
  pool: Pool;
}

export interface SearchResult {
  experiences: ExperienceRecord[];
  totalMatches: number;
}

/**
 * Search experiences using PostgreSQL full-text search (tsvector/tsquery).
 */
export async function searchExperiences(
  db: DbPool,
  query: string,
  agentId: string,
  limit = 20,
): Promise<SearchResult> {
  const { pool } = db;

  // Convert user query to tsquery (plain text to tsquery)
  const result = await pool.query(
    `SELECT *, COUNT(*) OVER()::int as total_count
     FROM experiences
     WHERE agent_id = $1
       AND task_description_tsv @@ to_tsquery('english', $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [agentId, query.split(/\s+/).join(' & '), limit],
  );

  const experiences = result.rows.map(rowToExperience);
  const totalMatches = result.rows.length > 0 ? (result.rows[0].total_count as number) : 0;

  return { experiences, totalMatches };
}

/**
 * Get experiences relevant to a task description using FTS matching.
 * Falls back to most recent experiences if no FTS match.
 */
export async function getRelevantExperiences(
  db: DbPool,
  taskDescription: string,
  agentId: string,
  limit = 5,
): Promise<ExperienceRecord[]> {
  const { pool } = db;

  // Try FTS match first
  const keywords = taskDescription
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join(' | ');

  if (keywords.length > 0) {
    const ftsResult = await pool.query(
      `SELECT * FROM experiences
       WHERE agent_id = $1
         AND task_description_tsv @@ to_tsquery('english', $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [agentId, keywords, limit],
    );

    if (ftsResult.rows.length > 0) {
      return ftsResult.rows.map(rowToExperience);
    }
  }

  // Fallback: most recent experiences for this agent
  const fallback = await pool.query(
    `SELECT * FROM experiences
     WHERE agent_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [agentId, limit],
  );

  return fallback.rows.map(rowToExperience);
}

/**
 * Summarize a list of experiences into a compact context string.
 * MVP: concatenation/truncation approach (no LLM call).
 */
export function summarizeExperiences(experiences: ExperienceRecord[]): string {
  if (experiences.length === 0) return '';

  const lines: string[] = [];

  for (const exp of experiences.slice(0, 10)) {
    const outcome = exp.success ? 'SUCCESS' : 'FAILURE';
    const lessons = exp.lessons.join('; ');
    lines.push(
      `[${outcome}] "${exp.taskDescription}" | approach: ${exp.approachTaken} | time: ${exp.timeTakenMs}ms | cost: ${exp.tokenCost} | lessons: ${lessons}`,
    );
  }

  return lines.join('\n');
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
