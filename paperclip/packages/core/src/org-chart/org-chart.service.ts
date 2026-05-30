import type { Company, Department, AIAgent } from '@paperclip/shared-types';
import type { Pool } from 'pg';

export interface DbPool {
  pool: Pool;
}

export async function createCompany(
  db: DbPool,
  name: string,
  settings?: Record<string, unknown>,
): Promise<Company> {
  const { pool } = db;
  const result = await pool.query<{
    id: string;
    name: string;
    settings: Record<string, unknown>;
  }>(
    `INSERT INTO companies (name, settings) VALUES ($1, $2)
     RETURNING id, name, settings`,
    [name, JSON.stringify(settings ?? {})],
  );
  const row = result.rows[0];

  const deptResult = await pool.query<{ id: string }>(
    `SELECT id FROM departments WHERE company_id = $1`,
    [row.id],
  );

  return {
    id: row.id,
    name: row.name,
    departments: deptResult.rows.map((d) => d.id),
    settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : (row.settings ?? {}),
  };
}

export async function createDepartment(
  db: DbPool,
  name: string,
  type: string,
  companyId: string,
): Promise<Department> {
  const { pool } = db;
  const result = await pool.query<{ id: string; name: string; type: string; company_id: string }>(
    `INSERT INTO departments (name, type, company_id) VALUES ($1, $2, $3)
     RETURNING id, name, type, company_id`,
    [name, type, companyId],
  );
  const row = result.rows[0];

  const agents = await pool.query<{ id: string }>(
    `SELECT id FROM agents WHERE department_id = $1`,
    [row.id],
  );

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    companyId: row.company_id,
    agentIds: agents.rows.map((a) => a.id),
    routineIds: [],
  };
}

export async function assignAgentToDepartment(
  db: DbPool,
  agentId: string,
  departmentId: string,
): Promise<AIAgent> {
  const { pool } = db;
  const result = await pool.query<AIAgent>(
    `UPDATE agents SET department_id = $1, updated_at = now() WHERE id = $2
     RETURNING id, name, role, department_id as "departmentId",
               skills, budget_limit as "budgetLimit",
               COALESCE(workspace_id::text, '') as "workspaceId",
               status`,
    [departmentId, agentId],
  );
  return result.rows[0];
}

export interface OrgChart {
  company: Company;
  departments: Array<{
    department: Department;
    agents: AIAgent[];
  }>;
}

export async function getOrgChart(db: DbPool, companyId: string): Promise<OrgChart | null> {
  const { pool } = db;

  const companyResult = await pool.query<{
    id: string;
    name: string;
    settings: Record<string, unknown>;
  }>(
    `SELECT id, name, settings FROM companies WHERE id = $1`,
    [companyId],
  );
  if (companyResult.rows.length === 0) return null;
  const companyRow = companyResult.rows[0];

  const depts = await pool.query<{ id: string; name: string; type: string; company_id: string }>(
    `SELECT id, name, type, company_id FROM departments WHERE company_id = $1`,
    [companyId],
  );

  const departments: OrgChart['departments'] = [];
  for (const deptRow of depts.rows) {
    const agents = await pool.query<AIAgent>(
      `SELECT id, name, role, department_id as "departmentId",
              skills, budget_limit as "budgetLimit",
              COALESCE(workspace_id::text, '') as "workspaceId",
              status
       FROM agents WHERE department_id = $1`,
      [deptRow.id],
    );

    departments.push({
      department: {
        id: deptRow.id,
        name: deptRow.name,
        type: deptRow.type,
        companyId: deptRow.company_id,
        agentIds: agents.rows.map((a) => a.id),
        routineIds: [],
      },
      agents: agents.rows,
    });
  }

  return {
    company: {
      id: companyRow.id,
      name: companyRow.name,
      departments: depts.rows.map((d) => d.id),
      settings: typeof companyRow.settings === 'string' ? JSON.parse(companyRow.settings) : (companyRow.settings ?? {}),
    },
    departments,
  };
}
