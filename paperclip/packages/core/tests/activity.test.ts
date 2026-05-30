import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logActivity, getActivityLog, getActivityForEntity } from '../src/activity/activity.service.js';

function createMockDb(queryMock?: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) {
  const query = queryMock ?? vi.fn(async () => ({ rows: [] }));
  return { pool: { query } };
}

describe('ActivityService', () => {
  let db: ReturnType<typeof createMockDb>;

  const mockActivityRow = {
    id: 'act-1',
    actor_id: 'agent-1',
    action: 'create',
    entity_type: 'task',
    entity_id: 'task-1',
    metadata: { key: 'value' },
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    db = createMockDb();
  });

  describe('logActivity', () => {
    it('should insert an activity log entry and return mapped result', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockActivityRow] }));

      const entry = await logActivity(db, {
        actorId: 'agent-1',
        action: 'create',
        entityType: 'task',
        entityId: 'task-1',
        metadata: { key: 'value' },
      });

      expect(entry.id).toBe('act-1');
      expect(entry.actorId).toBe('agent-1');
      expect(entry.action).toBe('create');
      expect(entry.entityType).toBe('task');
      expect(entry.entityId).toBe('task-1');
      expect(entry.metadata).toEqual({ key: 'value' });
    });

    it('should parse metadata from string if returned as string', async () => {
      db.pool.query = vi.fn(async () => ({
        rows: [{ ...mockActivityRow, metadata: '{"parsed":true}' }],
      }));

      const entry = await logActivity(db, {
        actorId: 'agent-1',
        action: 'create',
        entityType: 'task',
        entityId: 'task-1',
      });

      expect(entry.metadata).toEqual({ parsed: true });
    });

    it('should default metadata to empty object when null', async () => {
      db.pool.query = vi.fn(async () => ({
        rows: [{ ...mockActivityRow, metadata: null }],
      }));

      const entry = await logActivity(db, {
        actorId: 'agent-1',
        action: 'create',
        entityType: 'task',
        entityId: 'task-1',
      });

      expect(entry.metadata).toEqual({});
    });

    it('should serialize metadata as JSON in the insert', async () => {
      const queryFn = vi.fn(async () => ({ rows: [mockActivityRow] }));
      db.pool.query = queryFn;

      await logActivity(db, {
        actorId: 'agent-1',
        action: 'create',
        entityType: 'task',
        entityId: 'task-1',
        metadata: { foo: 'bar' },
      });

      // Check that JSON.stringify was used for metadata
      expect(queryFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify({ foo: 'bar' })]),
      );
    });

    it('should default metadata to {} when not provided', async () => {
      const queryFn = vi.fn(async () => ({ rows: [mockActivityRow] }));
      db.pool.query = queryFn;

      await logActivity(db, {
        actorId: 'agent-1',
        action: 'create',
        entityType: 'task',
        entityId: 'task-1',
      });

      expect(queryFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['{}']),
      );
    });
  });

  describe('getActivityLog', () => {
    it('should return activity entries mapped from rows', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockActivityRow] }));

      const entries = await getActivityLog(db);
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('act-1');
    });

    it('should apply all filters', async () => {
      const queryFn = vi.fn(async () => ({ rows: [mockActivityRow] }));
      db.pool.query = queryFn;

      await getActivityLog(db, {
        actorId: 'agent-1',
        action: 'create',
        entityType: 'task',
        entityId: 'task-1',
      });

      // Should have WHERE clause with all conditions
      const sql = queryFn.mock.calls[0][0] as string;
      expect(sql).toContain('actor_id');
      expect(sql).toContain('action');
      expect(sql).toContain('entity_type');
      expect(sql).toContain('entity_id');
    });

    it('should use default limit and offset when not provided', async () => {
      const queryFn = vi.fn(async () => ({ rows: [mockActivityRow] }));
      db.pool.query = queryFn;

      await getActivityLog(db);

      const params = queryFn.mock.calls[0][1] as unknown[];
      // Default limit=100, offset=0
      expect(params).toContain(100);
      expect(params).toContain(0);
    });

    it('should parse metadata strings in results', async () => {
      db.pool.query = vi.fn(async () => ({
        rows: [{ ...mockActivityRow, metadata: '{"k":"v"}' }],
      }));

      const entries = await getActivityLog(db);
      expect(entries[0].metadata).toEqual({ k: 'v' });
    });
  });

  describe('getActivityForEntity', () => {
    it('should delegate to getActivityLog with entity filters', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockActivityRow] }));

      const entries = await getActivityForEntity(db, 'task', 'task-1');
      expect(entries).toHaveLength(1);
    });
  });
});
