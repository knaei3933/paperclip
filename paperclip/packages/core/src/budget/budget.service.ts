import type { Pool } from 'pg';
import type { CostModel } from './cost-model.js';

export interface DbPool {
  pool: Pool;
}

export interface BudgetRecord {
  agentId: string;
  taskId: string;
  limit: number;
  spent: number;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

interface AgentBudgetAggregate {
  limit: number;
  spent: number;
}

const taskBudgets = new Map<string, BudgetRecord>();
const agentBudgets = new Map<string, AgentBudgetAggregate>();
let dbPool: Pool | null = null;

export async function initBudgetService(db: DbPool): Promise<void> {
  dbPool = db.pool;

  // Load all per-task budgets
  const taskResult = await dbPool.query<{ agent_id: string; task_id: string; limit: number; spent: number }>(
    'SELECT agent_id, task_id, limit, spent FROM budgets',
  );
  taskBudgets.clear();
  agentBudgets.clear();
  for (const row of taskResult.rows) {
    taskBudgets.set(row.task_id, {
      agentId: row.agent_id,
      taskId: row.task_id,
      limit: Number(row.limit),
      spent: Number(row.spent),
    });
  }

  // Load per-agent aggregates
  const agentResult = await dbPool.query<{ agent_id: string; total_spent: string; total_limit: string }>(
    'SELECT agent_id, SUM(spent) as total_spent, SUM(limit) as total_limit FROM budgets GROUP BY agent_id',
  );
  for (const row of agentResult.rows) {
    agentBudgets.set(row.agent_id, {
      limit: Number(row.total_limit),
      spent: Number(row.total_spent),
    });
  }
}

export async function allocateBudget(
  agentId: string,
  taskId: string,
  limit: number,
): Promise<BudgetRecord> {
  const record: BudgetRecord = { agentId, taskId, limit, spent: 0 };

  // Write to DB first
  if (dbPool) {
    await dbPool.query(
      'INSERT INTO budgets (agent_id, task_id, limit, spent) VALUES ($1, $2, $3, 0)',
      [agentId, taskId, limit],
    );
  }

  // Update in-memory cache
  taskBudgets.set(taskId, record);
  const existing = agentBudgets.get(agentId);
  if (existing) {
    existing.limit += limit;
  } else {
    agentBudgets.set(agentId, { limit, spent: 0 });
  }

  return record;
}

export async function trackSpend(agentId: string, taskId: string, cost: number): Promise<void> {
  // Update DB first
  if (dbPool) {
    await dbPool.query(
      'UPDATE budgets SET spent = spent + $1, updated_at = NOW() WHERE agent_id = $2 AND task_id = $3',
      [cost, agentId, taskId],
    );
  }

  // Update in-memory cache
  const taskBudget = taskBudgets.get(taskId);
  if (taskBudget) {
    taskBudget.spent += cost;
  }
  const agentBudget = agentBudgets.get(agentId);
  if (agentBudget) {
    agentBudget.spent += cost;
  }
}

export function checkBudget(agentId: string, taskId: string): { allowed: boolean; remaining: number } {
  const taskBudget = taskBudgets.get(taskId);
  const agentBudget = agentBudgets.get(agentId);

  const taskRemaining = taskBudget ? taskBudget.limit - taskBudget.spent : Infinity;
  const agentRemaining = agentBudget ? agentBudget.limit - agentBudget.spent : Infinity;
  const remaining = Math.min(taskRemaining, agentRemaining);

  return { allowed: remaining > 0, remaining };
}

export function getBudgetUtilization(agentId: string): { taskUtilization: Map<string, number>; agentUtilization: number } {
  const taskUtilization = new Map<string, number>();
  for (const [taskId, record] of taskBudgets) {
    if (record.agentId === agentId && record.limit > 0) {
      taskUtilization.set(taskId, record.spent / record.limit);
    }
  }

  const agentBudget = agentBudgets.get(agentId);
  const agentUtilization = agentBudget && agentBudget.limit > 0
    ? agentBudget.spent / agentBudget.limit
    : 0;

  return { taskUtilization, agentUtilization };
}

export function convertTokensToCost(usage: TokenUsage, model: CostModel): number {
  const promptCost = (usage.prompt / 1_000) * model.promptCostPer1K;
  const completionCost = (usage.completion / 1_000) * model.completionCostPer1K;
  return promptCost + completionCost;
}

export function resetBudgets(): void {
  taskBudgets.clear();
  agentBudgets.clear();
}
