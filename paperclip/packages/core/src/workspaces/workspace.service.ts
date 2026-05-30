import type { Workspace } from '@paperclip/shared-types';
import type { Pool } from 'pg';

export interface DbPool {
  pool: Pool;
}

export async function createWorkspace(
  db: DbPool,
  input: {
    type: string;
    runtime: string;
    isolationLevel: string;
    agentId: string;
  },
): Promise<Workspace> {
  const { pool } = db;
  const result = await pool.query<{
    id: string;
    type: string;
    runtime: string;
    isolation_level: string;
    agent_id: string;
  }>(
    `INSERT INTO workspaces (type, runtime, isolation_level, agent_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, type, runtime, isolation_level, agent_id`,
    [input.type, input.runtime, input.isolationLevel, input.agentId],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    type: row.type,
    runtime: row.runtime,
    isolationLevel: row.isolation_level,
    agentId: row.agent_id,
  };
}

export async function getWorkspace(
  db: DbPool,
  workspaceId: string,
): Promise<Workspace | null> {
  const { pool } = db;
  const result = await pool.query<{
    id: string;
    type: string;
    runtime: string;
    isolation_level: string;
    agent_id: string;
  }>(
    `SELECT id, type, runtime, isolation_level, agent_id
     FROM workspaces WHERE id = $1`,
    [workspaceId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    type: row.type,
    runtime: row.runtime,
    isolationLevel: row.isolation_level,
    agentId: row.agent_id,
  };
}

export async function assignAgentToWorkspace(
  db: DbPool,
  agentId: string,
  workspaceId: string,
): Promise<void> {
  const { pool } = db;
  await pool.query(
    `UPDATE agents SET workspace_id = $1, updated_at = now() WHERE id = $2`,
    [workspaceId, agentId],
  );
}
