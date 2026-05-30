import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateCEO, registerAgent, getAgentById, listAgentsByDepartment } from '../src/identity/identity.service.js';

function createMockDb() {
  const query = vi.fn(async () => ({ rows: [] }));
  return { pool: { query } };
}

describe('IdentityService', () => {
  let db: ReturnType<typeof createMockDb>;

  const mockAgentRow = {
    id: 'agent-1',
    name: 'CEO',
    role: 'CEO',
    departmentId: 'dept-1',
    skills: [],
    budgetLimit: 1000,
    workspaceId: '',
    status: 'idle',
  };

  beforeEach(() => {
    db = createMockDb();
  });

  describe('getOrCreateCEO', () => {
    it('should return existing CEO if found', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT') && sql.includes('CEO')) {
          return { rows: [mockAgentRow] };
        }
        return { rows: [] };
      });

      const agent = await getOrCreateCEO(db);
      expect(agent.role).toBe('CEO');
      expect(agent.id).toBe('agent-1');
    });

    it('should create CEO, company, and department if none exist', async () => {
      let callIdx = 0;
      db.pool.query = vi.fn(async (sql: string) => {
        callIdx++;
        if (sql.includes('SELECT') && sql.includes('CEO') && callIdx === 1) {
          return { rows: [] }; // no existing CEO
        }
        if (sql.includes('INSERT INTO companies')) {
          return { rows: [{ id: 'company-1' }] };
        }
        if (sql.includes('INSERT INTO departments')) {
          return { rows: [{ id: 'dept-1' }] };
        }
        if (sql.includes('INSERT INTO agents')) {
          return { rows: [mockAgentRow] };
        }
        return { rows: [] };
      });

      const agent = await getOrCreateCEO(db);
      expect(agent.role).toBe('CEO');
    });
  });

  describe('registerAgent', () => {
    it('should insert a new agent and return it', async () => {
      db.pool.query = vi.fn(async () => ({
        rows: [{
          ...mockAgentRow,
          name: 'Worker',
          role: 'engineer',
          departmentId: 'dept-1',
        }],
      }));

      const agent = await registerAgent(db, {
        name: 'Worker',
        role: 'engineer',
        departmentId: 'dept-1',
        skills: ['coding'],
        budgetLimit: 500,
      });

      expect(agent.name).toBe('Worker');
      expect(agent.role).toBe('engineer');
    });

    it('should use default skills and budgetLimit when not provided', async () => {
      const queryFn = vi.fn(async () => ({ rows: [mockAgentRow] }));
      db.pool.query = queryFn;

      await registerAgent(db, {
        name: 'Worker',
        role: 'engineer',
        departmentId: 'dept-1',
      });

      const params = queryFn.mock.calls[0][1] as unknown[];
      // skills defaults to [], budgetLimit defaults to 0
      expect(params).toContainEqual([]);
      expect(params).toContain(0);
    });
  });

  describe('getAgentById', () => {
    it('should return agent when found', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockAgentRow] }));

      const agent = await getAgentById(db, 'agent-1');
      expect(agent).not.toBeNull();
      expect(agent!.id).toBe('agent-1');
    });

    it('should return null when not found', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      const agent = await getAgentById(db, 'nonexistent');
      expect(agent).toBeNull();
    });
  });

  describe('listAgentsByDepartment', () => {
    it('should return agents in a department', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockAgentRow] }));

      const agents = await listAgentsByDepartment(db, 'dept-1');
      expect(agents).toHaveLength(1);
      expect(agents[0].departmentId).toBe('dept-1');
    });

    it('should return empty array when no agents in department', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      const agents = await listAgentsByDepartment(db, 'empty-dept');
      expect(agents).toHaveLength(0);
    });
  });
});
