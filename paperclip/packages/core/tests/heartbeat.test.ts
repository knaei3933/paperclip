import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeartbeatEngine } from '../src/heartbeat/heartbeat.engine.js';
import type { EventBus, AppDomainEvent } from '@paperclip/shared-types';

function createMockPool(overrides: Record<string, unknown> = {}) {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
    on: vi.fn(),
    ...overrides,
  };

  return {
    pool: {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn().mockResolvedValue({ rows: [] }),
      ...overrides,
    } as any,
    _mockClient: mockClient,
  };
}

function createMockEventBus(): EventBus & { emitted: AppDomainEvent[] } {
  const emitted: AppDomainEvent[] = [];
  return {
    emitted,
    emit: vi.fn((event: AppDomainEvent) => {
      emitted.push(event);
    }),
    on: vi.fn(),
    off: vi.fn(),
  };
}

describe('HeartbeatEngine', () => {
  let db: ReturnType<typeof createMockPool>;
  let eventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    db = createMockPool();
    eventBus = createMockEventBus();
  });

  describe('processNextTask', () => {
    it('returns null when no queued tasks', async () => {
      const engine = new HeartbeatEngine(db, eventBus, {
        pollIntervalMs: 999999,
        watchdogIntervalMs: 999999,
      });
      // Mock: BEGIN -> SELECT (empty) -> COMMIT
      db._mockClient.query
        .mockResolvedValueOnce(undefined)    // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT ... FOR UPDATE SKIP LOCKED
        .mockResolvedValueOnce(undefined);   // COMMIT

      const task = await engine.processNextTask();
      expect(task).toBeNull();
    });

    it('checks out a queued task and sets it to running', async () => {
      const engine = new HeartbeatEngine(db, eventBus, {
        pollIntervalMs: 999999,
        watchdogIntervalMs: 999999,
      });

      const mockTask = {
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
      };

      db._mockClient.query
        .mockResolvedValueOnce(undefined)              // BEGIN
        .mockResolvedValueOnce({ rows: [mockTask] })   // SELECT returns task
        .mockResolvedValueOnce(undefined)              // UPDATE status
        .mockResolvedValueOnce(undefined);             // COMMIT

      const task = await engine.processNextTask();
      expect(task).not.toBeNull();
      expect(task!.id).toBe('task-1');
      expect(task!.status).toBe('running');

      // Verify the UPDATE was called
      expect(db._mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'running'"),
        ['task-1'],
      );
    });

    it('rolls back on error during checkout', async () => {
      const engine = new HeartbeatEngine(db, eventBus, {
        pollIntervalMs: 999999,
        watchdogIntervalMs: 999999,
      });

      const mockTask = {
        id: 'task-1',
        title: 'Test',
        description: '',
        status: 'queued',
        assignee_id: null,
        budget_allocated: 0,
        budget_used: 0,
        priority: 5,
        result: null,
        retry_count: 0,
        created_at: new Date().toISOString(),
      };

      db._mockClient.query
        .mockResolvedValueOnce(undefined)              // BEGIN
        .mockResolvedValueOnce({ rows: [mockTask] })   // SELECT returns task
        .mockRejectedValueOnce(new Error('DB error'))  // UPDATE fails
        .mockResolvedValueOnce(undefined);              // ROLLBACK

      await expect(engine.processNextTask()).rejects.toThrow('DB error');
      expect(db._mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('checkStuckTasks', () => {
    it('detects stuck running tasks and re-queues with incremented retry count', async () => {
      const engine = new HeartbeatEngine(db, eventBus, {
        pollIntervalMs: 999999,
        watchdogIntervalMs: 999999,
        timeoutMs: 1000,
      });

      const oldDate = new Date(Date.now() - 5000).toISOString();
      const stuckTask = {
        id: 'stuck-1',
        title: 'Stuck',
        description: '',
        status: 'running',
        assignee_id: 'agent-1',
        budget_allocated: 0,
        budget_used: 0,
        priority: 5,
        result: null,
        retry_count: 1,
        created_at: oldDate,
        updated_at: oldDate,
      };

      // pool.query for the SELECT of stuck tasks
      (db.pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [stuckTask],
      });

      // Client for per-task processing
      const taskClient = {
        query: vi.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce(undefined) // UPDATE (re-queue)
          .mockResolvedValueOnce(undefined), // COMMIT
        release: vi.fn(),
      };
      (db.pool.connect as ReturnType<typeof vi.fn>).mockResolvedValueOnce(taskClient);

      const result = await engine.checkStuckTasks();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('stuck-1');

      // Verify retry count incremented
      expect(taskClient.query).toHaveBeenCalledWith(
        expect.stringContaining('retry_count = $1'),
        [2, 'stuck-1'],
      );

      // Verify event was emitted
      expect(eventBus.emitted).toHaveLength(1);
      expect(eventBus.emitted[0].type).toBe('TaskTimedOut');
    });

    it('marks task as permanently failed after max retries', async () => {
      const engine = new HeartbeatEngine(db, eventBus, {
        pollIntervalMs: 999999,
        watchdogIntervalMs: 999999,
        timeoutMs: 1000,
        maxRetries: 3,
      });

      const oldDate = new Date(Date.now() - 5000).toISOString();
      const stuckTask = {
        id: 'stuck-2',
        title: 'Stuck',
        description: '',
        status: 'running',
        assignee_id: 'agent-1',
        budget_allocated: 0,
        budget_used: 0,
        priority: 5,
        result: null,
        retry_count: 3,
        created_at: oldDate,
        updated_at: oldDate,
      };

      (db.pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [stuckTask],
      });

      const taskClient = {
        query: vi.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce(undefined) // UPDATE (permanent fail)
          .mockResolvedValueOnce(undefined), // COMMIT
        release: vi.fn(),
      };
      (db.pool.connect as ReturnType<typeof vi.fn>).mockResolvedValueOnce(taskClient);

      const result = await engine.checkStuckTasks();
      expect(result).toHaveLength(1);

      // Verify permanent failure (status = 'failed', not re-queue)
      expect(taskClient.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'failed'"),
        ['stuck-2'],
      );
    });

    it('returns empty array when no stuck tasks', async () => {
      const engine = new HeartbeatEngine(db, eventBus, {
        pollIntervalMs: 999999,
        watchdogIntervalMs: 999999,
        timeoutMs: 1000,
      });

      (db.pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [],
      });

      const result = await engine.checkStuckTasks();
      expect(result).toEqual([]);
    });
  });

  describe('start/stop', () => {
    it('start and stop without errors (polling-only mode when LISTEN fails)', async () => {
      // Force LISTEN to fail by making connect reject
      (db.pool.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('no db'),
      );

      const engine = new HeartbeatEngine(db, eventBus, {
        pollIntervalMs: 999999,
        watchdogIntervalMs: 999999,
      });

      await engine.start();
      expect(engine['running']).toBe(true);

      await engine.stop();
      expect(engine['running']).toBe(false);
    });
  });
});
