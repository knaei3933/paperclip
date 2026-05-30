import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompany, createDepartment, assignAgentToDepartment, getOrgChart } from '../src/org-chart/org-chart.service.js';

function createMockDb() {
  const query = vi.fn(async () => ({ rows: [] }));
  return { pool: { query } };
}

describe('OrgChartService', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('createCompany', () => {
    it('should create a company and return it with empty departments', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO companies')) {
          return { rows: [{ id: 'comp-1', name: 'TestCo', settings: {} }] };
        }
        if (sql.includes('SELECT id FROM departments')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const company = await createCompany(db, 'TestCo');
      expect(company.id).toBe('comp-1');
      expect(company.name).toBe('TestCo');
      expect(company.departments).toEqual([]);
    });

    it('should parse settings from string if returned as string', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO companies')) {
          return { rows: [{ id: 'comp-1', name: 'TestCo', settings: '{"theme":"dark"}' }] };
        }
        if (sql.includes('SELECT id FROM departments')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const company = await createCompany(db, 'TestCo');
      expect(company.settings).toEqual({ theme: 'dark' });
    });

    it('should include existing departments in result', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO companies')) {
          return { rows: [{ id: 'comp-1', name: 'TestCo', settings: {} }] };
        }
        if (sql.includes('SELECT id FROM departments')) {
          return { rows: [{ id: 'dept-1' }, { id: 'dept-2' }] };
        }
        return { rows: [] };
      });

      const company = await createCompany(db, 'TestCo');
      expect(company.departments).toEqual(['dept-1', 'dept-2']);
    });

    it('should use default empty settings when not provided', async () => {
      const queryFn = vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO companies')) {
          return { rows: [{ id: 'comp-1', name: 'TestCo', settings: {} }] };
        }
        if (sql.includes('SELECT id FROM departments')) {
          return { rows: [] };
        }
        return { rows: [] };
      });
      db.pool.query = queryFn;

      await createCompany(db, 'TestCo');
      // Should pass '{}' as settings
      expect(queryFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['{}']),
      );
    });
  });

  describe('createDepartment', () => {
    it('should create a department and return it', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO departments')) {
          return { rows: [{ id: 'dept-1', name: 'Engineering', type: 'tech', company_id: 'comp-1' }] };
        }
        if (sql.includes('SELECT id FROM agents')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const dept = await createDepartment(db, 'Engineering', 'tech', 'comp-1');
      expect(dept.id).toBe('dept-1');
      expect(dept.name).toBe('Engineering');
      expect(dept.type).toBe('tech');
      expect(dept.companyId).toBe('comp-1');
      expect(dept.agentIds).toEqual([]);
      expect(dept.routineIds).toEqual([]);
    });

    it('should include agents in the department result', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO departments')) {
          return { rows: [{ id: 'dept-1', name: 'Eng', type: 'tech', company_id: 'comp-1' }] };
        }
        if (sql.includes('SELECT id FROM agents')) {
          return { rows: [{ id: 'agent-1' }, { id: 'agent-2' }] };
        }
        return { rows: [] };
      });

      const dept = await createDepartment(db, 'Eng', 'tech', 'comp-1');
      expect(dept.agentIds).toEqual(['agent-1', 'agent-2']);
    });
  });

  describe('assignAgentToDepartment', () => {
    it('should update agent department and return agent', async () => {
      const mockAgent = {
        id: 'agent-1', name: 'Worker', role: 'engineer',
        departmentId: 'dept-2', skills: [], budgetLimit: 0,
        workspaceId: '', status: 'idle',
      };
      db.pool.query = vi.fn(async () => ({ rows: [mockAgent] }));

      const agent = await assignAgentToDepartment(db, 'agent-1', 'dept-2');
      expect(agent.departmentId).toBe('dept-2');
    });
  });

  describe('getOrgChart', () => {
    it('should return null when company not found', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      const chart = await getOrgChart(db, 'nonexistent');
      expect(chart).toBeNull();
    });

    it('should return full org chart with departments and agents', async () => {
      let callIdx = 0;
      db.pool.query = vi.fn(async (sql: string) => {
        callIdx++;
        if (sql.includes('SELECT id, name, settings FROM companies')) {
          return { rows: [{ id: 'comp-1', name: 'TestCo', settings: {} }] };
        }
        if (sql.includes('SELECT id, name, type, company_id FROM departments')) {
          return { rows: [{ id: 'dept-1', name: 'Engineering', type: 'tech', company_id: 'comp-1' }] };
        }
        if (sql.includes('SELECT id, name, role, department_id')) {
          return { rows: [{ id: 'agent-1', name: 'Worker', role: 'engineer', departmentId: 'dept-1', skills: [], budgetLimit: 0, workspaceId: '', status: 'idle' }] };
        }
        return { rows: [] };
      });

      const chart = await getOrgChart(db, 'comp-1');
      expect(chart).not.toBeNull();
      expect(chart!.company.id).toBe('comp-1');
      expect(chart!.company.name).toBe('TestCo');
      expect(chart!.departments).toHaveLength(1);
      expect(chart!.departments[0].department.id).toBe('dept-1');
      expect(chart!.departments[0].agents).toHaveLength(1);
    });

    it('should parse company settings from string', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT id, name, settings FROM companies')) {
          return { rows: [{ id: 'comp-1', name: 'TestCo', settings: '{"theme":"light"}' }] };
        }
        if (sql.includes('SELECT id, name, type, company_id FROM departments')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const chart = await getOrgChart(db, 'comp-1');
      expect(chart!.company.settings).toEqual({ theme: 'light' });
    });
  });
});
