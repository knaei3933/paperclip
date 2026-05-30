import type { AIAgent, AgentStatus } from '@paperclip/shared-types';
import type { Pool } from 'pg';

export interface DbPool {
  pool: Pool;
}

export interface RegisterAgentInput {
  name: string;
  role: string;
  departmentId: string;
  skills?: string[];
  budgetLimit?: number;
  capabilities?: string;
  adapterType?: string;
  adapterConfig?: Record<string, unknown>;
}

const AGENT_COLUMNS = `id, name, role, department_id as "departmentId",
            skills, budget_limit as "budgetLimit",
            COALESCE(workspace_id::text, '') as "workspaceId",
            status, capabilities, adapter_type as "adapterType",
            adapter_config as "adapterConfig",
            proactive_routines as "proactiveRoutines"`;

export async function getOrCreateCEO(db: DbPool): Promise<AIAgent> {
  const { pool } = db;
  const existing = await pool.query<AIAgent>(
    `SELECT ${AGENT_COLUMNS}
     FROM agents WHERE role IN ('CEO', '代表取締役') LIMIT 1`,
  );
  if (existing.rows.length > 0) return existing.rows[0];

  // Need a company and department first
  const company = await pool.query(
    `INSERT INTO companies (name) VALUES ('Default Company') RETURNING id`,
  );
  const dept = await pool.query(
    `INSERT INTO departments (name, type, company_id) VALUES ('Executive', 'executive', $1) RETURNING id`,
    [company.rows[0].id],
  );
  const result = await pool.query<AIAgent>(
    `INSERT INTO agents (name, role, department_id, skills, budget_limit, status, capabilities, adapter_type, adapter_config, proactive_routines)
     VALUES ('CEO', 'CEO', $1, '{}', 0, 'idle', 'Set direction, approve proposals, manage budget allocation for the trading company.', 'claude-code', '{}', '[]')
     RETURNING ${AGENT_COLUMNS}`,
    [dept.rows[0].id],
  );
  return result.rows[0];
}

export async function registerAgent(
  db: DbPool,
  input: RegisterAgentInput,
): Promise<AIAgent> {
  const { pool } = db;
  const result = await pool.query<AIAgent>(
    `INSERT INTO agents (name, role, department_id, skills, budget_limit, status, capabilities, adapter_type, adapter_config, proactive_routines)
     VALUES ($1, $2, $3, $4, $5, 'idle', $6, $7, $8, '[]')
     RETURNING ${AGENT_COLUMNS}`,
    [
      input.name,
      input.role,
      input.departmentId,
      input.skills ?? [],
      input.budgetLimit ?? 0,
      input.capabilities ?? '',
      input.adapterType ?? 'claude-code',
      JSON.stringify(input.adapterConfig ?? {}),
    ],
  );
  return result.rows[0];
}

export async function getAgentById(
  db: DbPool,
  agentId: string,
): Promise<AIAgent | null> {
  const { pool } = db;
  const result = await pool.query<AIAgent>(
    `SELECT ${AGENT_COLUMNS}
     FROM agents WHERE id = $1`,
    [agentId],
  );
  return result.rows[0] ?? null;
}

export async function listAgentsByDepartment(
  db: DbPool,
  departmentId: string,
): Promise<AIAgent[]> {
  const { pool } = db;
  const result = await pool.query<AIAgent>(
    `SELECT ${AGENT_COLUMNS}
     FROM agents WHERE department_id = $1`,
    [departmentId],
  );
  return result.rows;
}

export interface UpdateAgentInput {
  name?: string;
  role?: string;
  skills?: string[];
  budgetLimit?: number;
  capabilities?: string;
  adapterType?: string;
  adapterConfig?: Record<string, unknown>;
  proactiveRoutines?: unknown[];
}

export async function updateAgent(
  db: DbPool,
  agentId: string,
  updates: UpdateAgentInput,
): Promise<AIAgent | null> {
  const { pool } = db;
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(updates.name); }
  if (updates.role !== undefined) { setClauses.push(`role = $${idx++}`); values.push(updates.role); }
  if (updates.skills !== undefined) { setClauses.push(`skills = $${idx++}`); values.push(updates.skills); }
  if (updates.budgetLimit !== undefined) { setClauses.push(`budget_limit = $${idx++}`); values.push(updates.budgetLimit); }
  if (updates.capabilities !== undefined) { setClauses.push(`capabilities = $${idx++}`); values.push(updates.capabilities); }
  if (updates.adapterType !== undefined) { setClauses.push(`adapter_type = $${idx++}`); values.push(updates.adapterType); }
  if (updates.adapterConfig !== undefined) { setClauses.push(`adapter_config = $${idx++}`); values.push(JSON.stringify(updates.adapterConfig)); }
  if (updates.proactiveRoutines !== undefined) { setClauses.push(`proactive_routines = $${idx++}`); values.push(JSON.stringify(updates.proactiveRoutines)); }

  if (setClauses.length === 0) return getAgentById(db, agentId);

  values.push(agentId);
  const result = await pool.query<AIAgent>(
    `UPDATE agents SET ${setClauses.join(', ')} WHERE id = $${idx}
     RETURNING ${AGENT_COLUMNS}`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deactivateAgent(
  db: DbPool,
  agentId: string,
): Promise<boolean> {
  const { pool } = db;
  const result = await pool.query(
    `UPDATE agents SET status = 'inactive' WHERE id = $1`,
    [agentId],
  );
  return (result.rowCount ?? 0) > 0;
}
