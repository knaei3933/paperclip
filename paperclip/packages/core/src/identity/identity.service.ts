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
}

export async function getOrCreateCEO(db: DbPool): Promise<AIAgent> {
  const { pool } = db;
  const existing = await pool.query<AIAgent>(
    `SELECT id, name, role, department_id as "departmentId",
            skills, budget_limit as "budgetLimit",
            COALESCE(workspace_id::text, '') as "workspaceId",
            status
     FROM agents WHERE role = 'CEO' LIMIT 1`,
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
    `INSERT INTO agents (name, role, department_id, skills, budget_limit, status)
     VALUES ('CEO', 'CEO', $1, '{}', 0, 'idle')
     RETURNING id, name, role, department_id as "departmentId",
               skills, budget_limit as "budgetLimit",
               COALESCE(workspace_id::text, '') as "workspaceId",
               status`,
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
    `INSERT INTO agents (name, role, department_id, skills, budget_limit, status)
     VALUES ($1, $2, $3, $4, $5, 'idle')
     RETURNING id, name, role, department_id as "departmentId",
               skills, budget_limit as "budgetLimit",
               COALESCE(workspace_id::text, '') as "workspaceId",
               status`,
    [
      input.name,
      input.role,
      input.departmentId,
      input.skills ?? [],
      input.budgetLimit ?? 0,
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
    `SELECT id, name, role, department_id as "departmentId",
            skills, budget_limit as "budgetLimit",
            COALESCE(workspace_id::text, '') as "workspaceId",
            status
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
    `SELECT id, name, role, department_id as "departmentId",
            skills, budget_limit as "budgetLimit",
            COALESCE(workspace_id::text, '') as "workspaceId",
            status
     FROM agents WHERE department_id = $1`,
    [departmentId],
  );
  return result.rows;
}
