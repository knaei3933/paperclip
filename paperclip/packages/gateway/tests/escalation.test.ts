import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEscalation,
  approveEscalation,
  rejectEscalation,
  checkExpiredEscalations,
  getPendingEscalations,
  getEscalationById,
  setEscalationEventBus,
  setEscalationPool,
  resetEscalations,
  InProcessEventBus,
} from '@paperclip/core';

function createMockPool() {
  const store = new Map<string, any>();
  let idCounter = 0;

  const pool = {
    async query(sql: string, params?: any[]) {
      // INSERT
      if (sql.includes('INSERT INTO escalation_requests')) {
        idCounter++;
        const row: any = {
          id: `esc-${Date.now()}-${idCounter}`,
          task_id: params![0],
          reason: params![1],
          urgency: params![2],
          channel: params![3],
          status: 'pending',
          created_at: new Date().toISOString(),
          resolved_at: null,
        };
        store.set(row.id, row);
        return { rows: [row] };
      }

      // UPDATE status
      if (sql.includes('UPDATE escalation_requests SET status')) {
        // Expire query: WHERE status = 'pending' AND created_at < $1
        if (sql.includes('created_at < $1')) {
          const cutoff = new Date(params![0]).getTime();
          const expired: any[] = [];
          for (const row of store.values()) {
            if (row.status === 'pending' && new Date(row.created_at).getTime() < cutoff) {
              row.status = 'expired';
              row.resolved_at = new Date().toISOString();
              expired.push(row);
            }
          }
          return { rows: expired };
        }
        // Approve/reject query: WHERE id = $1 AND status = 'pending'
        const id = params![0];
        const row = store.get(id);
        if (!row || row.status !== 'pending') return { rows: [] };
        const newStatus = sql.includes("'approved'") ? 'approved' : sql.includes("'rejected'") ? 'rejected' : 'expired';
        row.status = newStatus;
        row.resolved_at = new Date().toISOString();
        return { rows: [row] };
      }

      // SELECT ... WHERE status = 'pending'
      if (sql.includes("status = 'pending'")) {
        const pending = Array.from(store.values()).filter((r: any) => r.status === 'pending');
        return { rows: pending };
      }

      // SELECT ... WHERE id = $1
      if (sql.includes('WHERE id = $1')) {
        const row = store.get(params![0]);
        return { rows: row ? [row] : [] };
      }

      // SELECT all
      if (sql.includes('ORDER BY created_at')) {
        return { rows: Array.from(store.values()) };
      }

      return { rows: [] };
    },
    _store: store,
  };

  return pool;
}

describe('Escalation Service', () => {
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    resetEscalations();
    mockPool = createMockPool();
    setEscalationPool(mockPool as any);
  });

  it('creates an escalation with pending status', async () => {
    const esc = await createEscalation({
      taskId: 'task-1',
      reason: 'Budget exceeded',
      urgency: 'high',
    });

    expect(esc.id).toBeDefined();
    expect(esc.taskId).toBe('task-1');
    expect(esc.reason).toBe('Budget exceeded');
    expect(esc.urgency).toBe('high');
    expect(esc.status).toBe('pending');
    expect(esc.resolvedAt).toBeNull();
  });

  it('approves a pending escalation', async () => {
    const esc = await createEscalation({
      taskId: 'task-2',
      reason: 'High risk',
      urgency: 'critical',
    });

    const approved = await approveEscalation(esc.id);
    expect(approved.status).toBe('approved');
    expect(approved.resolvedAt).not.toBeNull();
  });

  it('rejects a pending escalation', async () => {
    const esc = await createEscalation({
      taskId: 'task-3',
      reason: 'Sensitive data',
      urgency: 'medium',
    });

    const rejected = await rejectEscalation(esc.id);
    expect(rejected.status).toBe('rejected');
    expect(rejected.resolvedAt).not.toBeNull();
  });

  it('throws when approving already resolved escalation', async () => {
    const esc = await createEscalation({
      taskId: 'task-4',
      reason: 'Test',
      urgency: 'low',
    });
    await approveEscalation(esc.id);

    await expect(approveEscalation(esc.id)).rejects.toThrow('already resolved');
  });

  it('throws when escalation not found', async () => {
    await expect(approveEscalation('nonexistent')).rejects.toThrow('not found');
  });

  it('expires escalations past timeout', async () => {
    await createEscalation({
      taskId: 'task-5',
      reason: 'Test timeout',
      urgency: 'low',
    });

    // Manually set created_at to the past in the mock store
    for (const row of mockPool._store.values()) {
      row.created_at = new Date(Date.now() - 1000).toISOString();
    }

    const expired = await checkExpiredEscalations(1); // 1ms timeout
    expect(expired.length).toBeGreaterThanOrEqual(1);
    expect(expired[0].status).toBe('expired');
  });

  it('returns pending escalations', async () => {
    await createEscalation({ taskId: 't1', reason: 'r1', urgency: 'low' });
    await createEscalation({ taskId: 't2', reason: 'r2', urgency: 'medium' });
    const esc3 = await createEscalation({ taskId: 't3', reason: 'r3', urgency: 'high' });
    await approveEscalation(esc3.id);

    const pending = await getPendingEscalations();
    expect(pending).toHaveLength(2);
  });

  it('emits EscalationCreated event', async () => {
    const bus = new InProcessEventBus();
    setEscalationEventBus(bus);

    const handler = vi.fn();
    bus.on('EscalationCreated', handler);

    await createEscalation({
      taskId: 'task-evt',
      reason: 'Event test',
      urgency: 'high',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const payload = handler.mock.calls[0][0].payload as { escalationId: string; taskId: string };
    expect(payload.taskId).toBe('task-evt');
    expect(payload.escalationId).toBeDefined();
  });

  it('gets escalation by id', async () => {
    const esc = await createEscalation({
      taskId: 'task-get',
      reason: 'Get test',
      urgency: 'low',
    });

    const found = await getEscalationById(esc.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(esc.id);

    const notFound = await getEscalationById('nonexistent');
    expect(notFound).toBeNull();
  });
});
