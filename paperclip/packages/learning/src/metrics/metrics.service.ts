import type { Pool } from 'pg';

export interface DbPool {
  pool: Pool;
}

export interface AgentMetrics {
  agentId: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  successRate: number;
  avgCompletionTimeMs: number;
  avgTokenCost: number;
  totalTokenCost: number;
  skillCount: number;
}

export interface ImprovementTrend {
  period: string;
  successRate: number;
  avgCompletionTimeMs: number;
  costEfficiency: number;
  timestamp: Date;
}

export interface MetricSnapshot {
  id: string;
  agentId: string;
  accuracy: number;
  efficiency: number;
  taskCompletionRate: number;
  avgCompletionTimeMs: number | null;
  costEfficiency: number | null;
  recordedAt: Date;
}

/**
 * Compute current metrics for an agent.
 */
export async function computeAgentMetrics(
  db: DbPool,
  agentId: string,
): Promise<AgentMetrics> {
  const { pool } = db;

  const expResult = await pool.query(
    `SELECT
       COUNT(*)::int as total_tasks,
       COUNT(*) FILTER (WHERE success_flag = true)::int as successful_tasks,
       COUNT(*) FILTER (WHERE success_flag = false)::int as failed_tasks,
       COALESCE(AVG(time_taken_ms) FILTER (WHERE success_flag = true), 0)::numeric as avg_completion_time,
       COALESCE(AVG(token_cost), 0)::numeric as avg_token_cost,
       COALESCE(SUM(token_cost), 0)::numeric as total_token_cost
     FROM experiences
     WHERE agent_id = $1`,
    [agentId],
  );

  const skillResult = await pool.query(
    `SELECT COUNT(*)::int as count
     FROM agent_skills
     WHERE agent_id = $1 AND deprecated_at IS NULL`,
    [agentId],
  );

  const row = expResult.rows[0];
  const total = row.total_tasks;
  const successful = row.successful_tasks;

  return {
    agentId,
    totalTasks: total,
    successfulTasks: successful,
    failedTasks: row.failed_tasks,
    successRate: total > 0 ? successful / total : 0,
    avgCompletionTimeMs: Number(row.avg_completion_time),
    avgTokenCost: Number(row.avg_token_cost),
    totalTokenCost: Number(row.total_token_cost),
    skillCount: skillResult.rows[0].count,
  };
}

/**
 * Get improvement trend over time from metric snapshots.
 */
export async function getImprovementTrend(
  db: DbPool,
  agentId: string,
): Promise<ImprovementTrend[]> {
  const { pool } = db;

  const result = await pool.query(
    `SELECT h.accuracy, h.efficiency, h.task_completion_rate,
       h.avg_completion_time_ms, h.cost_efficiency, h.recorded_at
     FROM self_improvement_history h
     JOIN self_improvement_metrics m ON h.self_improvement_id = m.id
     WHERE m.agent_id = $1
     ORDER BY h.recorded_at ASC`,
    [agentId],
  );

  return result.rows.map((row) => ({
    period: new Date(row.recorded_at).toISOString().split('T')[0],
    successRate: Number(row.task_completion_rate ?? 0),
    avgCompletionTimeMs: Number(row.avg_completion_time_ms ?? 0),
    costEfficiency: Number(row.cost_efficiency ?? 0),
    timestamp: new Date(row.recorded_at),
  }));
}

/**
 * Record a periodic metric snapshot for an agent.
 */
export async function recordMetricSnapshot(
  db: DbPool,
  agentId: string,
): Promise<MetricSnapshot> {
  const { pool } = db;
  const metrics = await computeAgentMetrics(db, agentId);

  // Ensure agent has a self_improvement_metrics row
  let siId: string | null = null;
  const siResult = await pool.query(
    `SELECT id FROM self_improvement_metrics WHERE agent_id = $1 LIMIT 1`,
    [agentId],
  );

  if (siResult.rows.length > 0) {
    siId = siResult.rows[0].id;
    await pool.query(
      `UPDATE self_improvement_metrics SET cycle_count = cycle_count + 1, updated_at = now() WHERE id = $1`,
      [siId],
    );
  } else {
    const insertSi = await pool.query(
      `INSERT INTO self_improvement_metrics (agent_id, cycle_count) VALUES ($1, 1) RETURNING id`,
      [agentId],
    );
    siId = insertSi.rows[0].id;
  }

  // Insert history snapshot
  const histResult = await pool.query(
    `INSERT INTO self_improvement_history
       (self_improvement_id, accuracy, efficiency, task_completion_rate, avg_completion_time_ms, cost_efficiency)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, self_improvement_id, accuracy, efficiency, task_completion_rate,
               avg_completion_time_ms, cost_efficiency, recorded_at`,
    [
      siId,
      metrics.successRate,
      metrics.totalTasks > 0 ? metrics.successfulTasks / metrics.totalTasks : 0,
      metrics.successRate,
      metrics.avgCompletionTimeMs,
      metrics.avgTokenCost > 0 ? metrics.successfulTasks / metrics.totalTokenCost : 0,
    ],
  );

  const row = histResult.rows[0];
  return {
    id: row.id,
    agentId,
    accuracy: Number(row.accuracy),
    efficiency: Number(row.efficiency),
    taskCompletionRate: Number(row.task_completion_rate),
    avgCompletionTimeMs: row.avg_completion_time_ms != null ? Number(row.avg_completion_time_ms) : null,
    costEfficiency: row.cost_efficiency != null ? Number(row.cost_efficiency) : null,
    recordedAt: new Date(row.recorded_at),
  };
}

/**
 * Get a metrics dashboard summary for all agents or a specific one.
 */
export async function getMetricsDashboard(
  db: DbPool,
  agentId?: string,
): Promise<AgentMetrics[]> {
  const { pool } = db;

  if (agentId) {
    return [await computeAgentMetrics(db, agentId)];
  }

  // Get all agents with experiences
  const agentsResult = await pool.query(
    `SELECT DISTINCT agent_id FROM experiences WHERE agent_id IS NOT NULL`,
  );

  const results: AgentMetrics[] = [];
  for (const row of agentsResult.rows) {
    results.push(await computeAgentMetrics(db, row.agent_id));
  }
  return results;
}
