import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeAgentMetrics, getImprovementTrend, recordMetricSnapshot, getMetricsDashboard } from '../src/metrics/metrics.service.js';
import { createMockDb } from './test-utils.js';

describe('Metrics', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it('should compute agent metrics from experiences', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM experiences')) {
        return {
          rows: [{
            total_tasks: 20,
            successful_tasks: 16,
            failed_tasks: 4,
            avg_completion_time: 1500,
            avg_token_cost: 80,
            total_token_cost: 1600,
          }],
        };
      }
      if (sql.includes('FROM agent_skills')) {
        return { rows: [{ count: 3 }] };
      }
      return { rows: [] };
    });

    const metrics = await computeAgentMetrics(db, 'agent-1');

    expect(metrics.agentId).toBe('agent-1');
    expect(metrics.totalTasks).toBe(20);
    expect(metrics.successfulTasks).toBe(16);
    expect(metrics.successRate).toBeCloseTo(0.8);
    expect(metrics.skillCount).toBe(3);
  });

  it('should handle zero tasks gracefully', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM experiences')) {
        return {
          rows: [{
            total_tasks: 0,
            successful_tasks: 0,
            failed_tasks: 0,
            avg_completion_time: 0,
            avg_token_cost: 0,
            total_token_cost: 0,
          }],
        };
      }
      if (sql.includes('FROM agent_skills')) {
        return { rows: [{ count: 0 }] };
      }
      return { rows: [] };
    });

    const metrics = await computeAgentMetrics(db, 'agent-1');
    expect(metrics.successRate).toBe(0);
    expect(metrics.totalTasks).toBe(0);
  });

  it('should get improvement trend from history', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('self_improvement_history')) {
        return {
          rows: [
            {
              accuracy: 0.6,
              efficiency: 0.7,
              task_completion_rate: 0.65,
              avg_completion_time_ms: 2000,
              cost_efficiency: 0.01,
              recorded_at: '2025-01-01T00:00:00Z',
            },
            {
              accuracy: 0.8,
              efficiency: 0.85,
              task_completion_rate: 0.82,
              avg_completion_time_ms: 1500,
              cost_efficiency: 0.015,
              recorded_at: '2025-01-02T00:00:00Z',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const trend = await getImprovementTrend(db, 'agent-1');

    expect(trend).toHaveLength(2);
    expect(trend[1].successRate).toBeCloseTo(0.82);
    // Improvement: time decreased from 2000 to 1500
    expect(trend[1].avgCompletionTimeMs).toBeLessThan(trend[0].avgCompletionTimeMs);
  });

  it('should record a metric snapshot', async () => {
    let callIdx = 0;
    db.pool.query = vi.fn(async (sql: string) => {
      callIdx++;
      if (sql.includes('FROM experiences') && sql.includes('COUNT')) {
        return {
          rows: [{
            total_tasks: 10,
            successful_tasks: 8,
            failed_tasks: 2,
            avg_completion_time: 1200,
            avg_token_cost: 60,
            total_token_cost: 600,
          }],
        };
      }
      if (sql.includes('FROM agent_skills') && sql.includes('COUNT')) {
        return { rows: [{ count: 2 }] };
      }
      if (sql.includes('SELECT id FROM self_improvement_metrics')) {
        return { rows: [{ id: 'si-1' }] };
      }
      if (sql.includes('INSERT INTO self_improvement_history')) {
        return {
          rows: [{
            id: 'hist-1',
            self_improvement_id: 'si-1',
            accuracy: 0.8,
            efficiency: 0.8,
            task_completion_rate: 0.8,
            avg_completion_time_ms: 1200,
            cost_efficiency: 0.013,
            recorded_at: new Date().toISOString(),
          }],
        };
      }
      return { rows: [] };
    });

    const snapshot = await recordMetricSnapshot(db, 'agent-1');

    expect(snapshot.id).toBe('hist-1');
    expect(snapshot.accuracy).toBeCloseTo(0.8);
    expect(snapshot.agentId).toBe('agent-1');
  });

  it('should record metric snapshot when no existing SI row', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM experiences') && sql.includes('COUNT')) {
        return {
          rows: [{
            total_tasks: 5,
            successful_tasks: 4,
            failed_tasks: 1,
            avg_completion_time: 1000,
            avg_token_cost: 50,
            total_token_cost: 250,
          }],
        };
      }
      if (sql.includes('FROM agent_skills') && sql.includes('COUNT')) {
        return { rows: [{ count: 1 }] };
      }
      if (sql.includes('SELECT id FROM self_improvement_metrics')) {
        return { rows: [] }; // no existing SI row
      }
      if (sql.includes('INSERT INTO self_improvement_metrics')) {
        return { rows: [{ id: 'si-new' }] };
      }
      if (sql.includes('INSERT INTO self_improvement_history')) {
        return {
          rows: [{
            id: 'hist-new',
            self_improvement_id: 'si-new',
            accuracy: 0.8,
            efficiency: 0.8,
            task_completion_rate: 0.8,
            avg_completion_time_ms: 1000,
            cost_efficiency: 0.016,
            recorded_at: new Date().toISOString(),
          }],
        };
      }
      return { rows: [] };
    });

    const snapshot = await recordMetricSnapshot(db, 'agent-1');
    expect(snapshot.id).toBe('hist-new');
    expect(snapshot.accuracy).toBeCloseTo(0.8);
  });

  it('should get metrics dashboard for a specific agent', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM experiences')) {
        return {
          rows: [{
            total_tasks: 10,
            successful_tasks: 8,
            failed_tasks: 2,
            avg_completion_time: 1200,
            avg_token_cost: 60,
            total_token_cost: 600,
          }],
        };
      }
      if (sql.includes('FROM agent_skills')) {
        return { rows: [{ count: 2 }] };
      }
      return { rows: [] };
    });

    const dashboard = await getMetricsDashboard(db, 'agent-1');
    expect(dashboard).toHaveLength(1);
    expect(dashboard[0].agentId).toBe('agent-1');
  });

  it('should get metrics dashboard for all agents', async () => {
    let callIdx = 0;
    db.pool.query = vi.fn(async (sql: string) => {
      callIdx++;
      if (sql.includes('DISTINCT agent_id FROM experiences')) {
        return { rows: [{ agent_id: 'agent-1' }, { agent_id: 'agent-2' }] };
      }
      // computeAgentMetrics queries
      if (sql.includes('FROM experiences') && sql.includes('agent_id = $1')) {
        return {
          rows: [{
            total_tasks: 5,
            successful_tasks: 4,
            failed_tasks: 1,
            avg_completion_time: 1000,
            avg_token_cost: 50,
            total_token_cost: 250,
          }],
        };
      }
      if (sql.includes('FROM agent_skills') && sql.includes('agent_id = $1')) {
        return { rows: [{ count: 1 }] };
      }
      return { rows: [] };
    });

    const dashboard = await getMetricsDashboard(db);
    expect(dashboard).toHaveLength(2);
  });
});
