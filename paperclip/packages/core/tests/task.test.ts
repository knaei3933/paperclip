import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTask, assignTask, transitionStatus, getTasks, getTaskById } from '../src/tasks/task.service.js';

function createMockDb() {
  const query = vi.fn(async () => ({ rows: [] }));
  return { pool: { query } };
}

describe('TaskService', () => {
  let db: ReturnType<typeof createMockDb>;

  const mockTaskRow = {
    id: 'task-1',
    title: 'Test task',
    description: 'desc',
    status: 'queued',
    assignee_id: null,
    budget_allocated: 0,
    budget_used: 0,
    priority: 5,
    result: null,
    retry_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    db = createMockDb();
  });

  describe('createTask', () => {
    it('should create a queued task when no assignee', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockTaskRow] }));

      const task = await createTask(db, { title: 'Test task' });
      expect(task.id).toBe('task-1');
      expect(task.title).toBe('Test task');
    });

    it('should create an assigned task when assignee is provided', async () => {
      const queryFn = vi.fn(async () => ({
        rows: [{ ...mockTaskRow, status: 'assigned', assignee_id: 'agent-1' }],
      }));
      db.pool.query = queryFn;

      const task = await createTask(db, { title: 'Test', assigneeId: 'agent-1' });
      expect(task.assigneeId).toBe('agent-1');

      // Verify the status was set to 'assigned'
      const params = queryFn.mock.calls[0][1] as unknown[];
      expect(params).toContain('assigned');
    });

    it('should use default values for optional fields', async () => {
      const queryFn = vi.fn(async () => ({ rows: [mockTaskRow] }));
      db.pool.query = queryFn;

      await createTask(db, { title: 'Test' });

      const params = queryFn.mock.calls[0][1] as unknown[];
      expect(params).toContain(''); // description default
      expect(params).toContain(0); // budgetAllocated default
      expect(params).toContain(5); // priority default
    });
  });

  describe('assignTask', () => {
    it('should assign task and transition queued to assigned', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT status')) {
          return { rows: [{ status: 'queued' }] };
        }
        return { rows: [{ ...mockTaskRow, status: 'assigned', assignee_id: 'agent-1' }] };
      });

      const task = await assignTask(db, 'task-1', 'agent-1');
      expect(task.assigneeId).toBe('agent-1');
    });

    it('should keep status when task is not queued', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT status')) {
          return { rows: [{ status: 'running' }] };
        }
        return { rows: [{ ...mockTaskRow, status: 'running', assignee_id: 'agent-1' }] };
      });

      const task = await assignTask(db, 'task-1', 'agent-1');
      expect(task.status).toBe('running');
    });

    it('should throw when task not found', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      await expect(assignTask(db, 'nonexistent', 'agent-1')).rejects.toThrow('Task not found');
    });
  });

  describe('transitionStatus', () => {
    it('should transition task status', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT status')) {
          return { rows: [{ status: 'assigned' }] };
        }
        return { rows: [{ ...mockTaskRow, status: 'running' }] };
      });

      const task = await transitionStatus(db, 'task-1', 'running');
      expect(task.status).toBe('running');
    });

    it('should throw when task not found', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      await expect(transitionStatus(db, 'nonexistent', 'running')).rejects.toThrow('Task not found');
    });

    it('should throw on invalid transition', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT status')) {
          return { rows: [{ status: 'completed' }] };
        }
        return { rows: [] };
      });

      await expect(transitionStatus(db, 'task-1', 'running')).rejects.toThrow('Invalid task status transition');
    });
  });

  describe('getTasks', () => {
    it('should return tasks with no filters', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockTaskRow] }));

      const tasks = await getTasks(db);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-1');
    });

    it('should apply status filter', async () => {
      const queryFn = vi.fn(async () => ({ rows: [mockTaskRow] }));
      db.pool.query = queryFn;

      await getTasks(db, { status: 'queued' });
      const sql = queryFn.mock.calls[0][0] as string;
      expect(sql).toContain('status = $1');
    });

    it('should apply all filters', async () => {
      const queryFn = vi.fn(async () => ({ rows: [mockTaskRow] }));
      db.pool.query = queryFn;

      await getTasks(db, { status: 'queued', assigneeId: 'agent-1', priority: 5 });
      const sql = queryFn.mock.calls[0][0] as string;
      expect(sql).toContain('status = $1');
      expect(sql).toContain('assignee_id = $2');
      expect(sql).toContain('priority = $3');
    });

    it('should use default limit and offset', async () => {
      const queryFn = vi.fn(async () => ({ rows: [mockTaskRow] }));
      db.pool.query = queryFn;

      await getTasks(db);
      const params = queryFn.mock.calls[0][1] as unknown[];
      expect(params).toContain(100);
      expect(params).toContain(0);
    });
  });

  describe('getTaskById', () => {
    it('should return task when found', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockTaskRow] }));

      const task = await getTaskById(db, 'task-1');
      expect(task).not.toBeNull();
      expect(task!.id).toBe('task-1');
    });

    it('should return null when not found', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      const task = await getTaskById(db, 'nonexistent');
      expect(task).toBeNull();
    });
  });
});
