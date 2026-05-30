import { describe, it, expect, beforeEach } from 'vitest';
import { ApiServer } from '../src/api/api-server.js';
import type { ApiServerDeps } from '../src/api/api-server.js';
import {
  InProcessEventBus,
  setThreshold,
  getThresholds,
  resetThresholds,
  createEscalation,
  approveEscalation,
  rejectEscalation,
  getPendingEscalations,
  resetEscalations,
  setEscalationEventBus,
  setEscalationPool,
} from '@paperclip/core';

function createMockEscalationPool() {
  const store = new Map<string, any>();
  let idCounter = 0;

  return {
    pool: {
      async query(sql: string, params?: any[]) {
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
        if (sql.includes('UPDATE escalation_requests SET status')) {
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
          const id = params![0];
          const row = store.get(id);
          if (!row || row.status !== 'pending') return { rows: [] };
          const newStatus = sql.includes("'approved'") ? 'approved' : sql.includes("'rejected'") ? 'rejected' : 'expired';
          row.status = newStatus;
          row.resolved_at = new Date().toISOString();
          return { rows: [row] };
        }
        if (sql.includes("status = 'pending'")) {
          return { rows: Array.from(store.values()).filter((r: any) => r.status === 'pending') };
        }
        if (sql.includes('WHERE id = $1')) {
          const row = store.get(params![0]);
          return { rows: row ? [row] : [] };
        }
        if (sql.includes('ORDER BY created_at')) {
          return { rows: Array.from(store.values()) };
        }
        return { rows: [] };
      },
    } as any,
  };
}

function createTestDeps(): ApiServerDeps {
  const bus = new InProcessEventBus();
  setEscalationEventBus(bus);

  return {
    eventBus: bus,
    getHealth: async () => ({ status: 'ok', adapters: { telegram: true, slack: false } }),
    listAgents: async () => ({ agents: [{ id: 'a1', name: 'Agent1' }], total: 1 }),
    listTasks: async () => [{ id: 't1', title: 'Task 1' }],
    createTask: async (input) => ({ id: 'new-task', ...input }),
    getTaskById: async (id) => id === 't1' ? { id: 't1', title: 'Task 1' } : null,
    getPendingEscalations: async () => getPendingEscalations(),
    approveEscalation: async (id: string) => approveEscalation(id),
    rejectEscalation: async (id: string) => rejectEscalation(id),
    getImprovementMetrics: async () => ({ accuracy: 0.85 }),
    getBudgetUtilization: async () => ({ spent: 50, limit: 100 }),
    getThresholds: () => getThresholds(),
    setThreshold: async (t: Record<string, unknown>) => setThreshold(t as Parameters<typeof setThreshold>[0]),
    routeEscalation: async () => [],
    createPipeline: async (input) => ({ id: 'pipe-1', ...input }),
    listPipelines: async () => [],
    getPipelineById: async () => null,
    advancePipeline: async () => ({ advanced: false }),
    updateAgent: async () => null,
    deactivateAgent: async () => false,
  };
}

async function request(server: ApiServer, method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return server.handleRequest(new Request(`http://localhost${path}`, init));
}

describe('API Routes', () => {
  let server: ApiServer;

  beforeEach(() => {
    resetThresholds();
    resetEscalations();
    const { pool } = createMockEscalationPool();
    setEscalationPool(pool);
    server = new ApiServer(createTestDeps());
  });

  it('GET /api/health returns health status', async () => {
    const res = await request(server, 'GET', '/api/health');
    expect(res.status).toBe(200);
    const data = await res.json() as { status: string; adapters: Record<string, boolean> };
    expect(data.status).toBe('ok');
    expect(data.adapters.telegram).toBe(true);
    expect(data.adapters.slack).toBe(false);
  });

  it('GET /api/agents returns agent list', async () => {
    const res = await request(server, 'GET', '/api/agents');
    expect(res.status).toBe(200);
    const data = await res.json() as { agents: unknown[]; total: number };
    expect(data.agents).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it('GET /api/tasks returns task list', async () => {
    const res = await request(server, 'GET', '/api/tasks');
    expect(res.status).toBe(200);
    const data = await res.json() as { tasks: unknown[]; total: number };
    expect(data.tasks).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it('POST /api/tasks creates a task', async () => {
    const res = await request(server, 'POST', '/api/tasks', { title: 'New Task' });
    expect(res.status).toBe(201);
    const data = await res.json() as { task: Record<string, unknown> };
    expect(data.task.title).toBe('New Task');
  });

  it('GET /api/tasks/:id returns task by id', async () => {
    const res = await request(server, 'GET', '/api/tasks/t1');
    expect(res.status).toBe(200);
    const data = await res.json() as { task: Record<string, unknown> };
    expect(data.task.id).toBe('t1');
  });

  it('GET /api/tasks/:id returns 404 for unknown task', async () => {
    const res = await request(server, 'GET', '/api/tasks/nonexistent');
    expect(res.status).toBe(404);
  });

  it('GET /api/approvals returns pending escalations', async () => {
    await createEscalation({ taskId: 't1', reason: 'test', urgency: 'high' });
    const res = await request(server, 'GET', '/api/approvals');
    expect(res.status).toBe(200);
    const data = await res.json() as { escalations: unknown[] };
    expect(data.escalations).toHaveLength(1);
  });

  it('POST /api/approvals/:id/approve approves escalation', async () => {
    const esc = await createEscalation({ taskId: 't1', reason: 'test', urgency: 'high' });
    const res = await request(server, 'POST', `/api/approvals/${esc.id}/approve`);
    expect(res.status).toBe(200);
    const data = await res.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('POST /api/approvals/:id/reject rejects escalation', async () => {
    const esc = await createEscalation({ taskId: 't1', reason: 'test', urgency: 'high' });
    const res = await request(server, 'POST', `/api/approvals/${esc.id}/reject`);
    expect(res.status).toBe(200);
    const data = await res.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('GET /api/settings/thresholds returns threshold config', async () => {
    const res = await request(server, 'GET', '/api/settings/thresholds');
    expect(res.status).toBe(200);
    const data = await res.json() as { thresholds: unknown[] };
    expect(data.thresholds.length).toBe(4);
  });

  it('PUT /api/settings/thresholds updates threshold config', async () => {
    const res = await request(server, 'PUT', '/api/settings/thresholds', {
      id: 'budget-1',
      dimension: 'budget',
      value: 500,
      timeoutMs: 60000,
      timeoutAction: 'auto_reject',
      scope: '',
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('GET /api/budget returns budget utilization', async () => {
    const res = await request(server, 'GET', '/api/budget');
    expect(res.status).toBe(200);
    const data = await res.json() as { spent: number; limit: number };
    expect(data.spent).toBe(50);
    expect(data.limit).toBe(100);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(server, 'GET', '/api/unknown');
    expect(res.status).toBe(404);
  });
});
