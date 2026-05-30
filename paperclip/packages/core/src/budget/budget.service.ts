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

  taskBudgets.clear();
  agentBudgets.clear();

  // Load per-agent budget aggregates from actual schema (allocated, used)
  const result = await dbPool.query<{ agent_id: string; allocated: string; used: string }>(
    'SELECT agent_id, SUM(allocated) as allocated, SUM(used) as used FROM budgets GROUP BY agent_id',
  );
  for (const row of result.rows) {
    if (row.agent_id) {
      agentBudgets.set(row.agent_id, {
        limit: Number(row.allocated),
        spent: Number(row.used),
      });
    }
  }
}

export async function allocateBudget(
  agentId: string,
  taskId: string,
  limit: number,
): Promise<BudgetRecord> {
  const record: BudgetRecord = { agentId, taskId, limit, spent: 0 };

  // Write to DB
  if (dbPool) {
    await dbPool.query(
      'INSERT INTO budgets (id, agent_id, allocated, used) VALUES ($1, $2, $3, 0)',
      [taskId, agentId, limit],
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
  // Update DB
  if (dbPool) {
    await dbPool.query(
      'UPDATE budgets SET used = used + $1, updated_at = NOW() WHERE id = $2',
      [cost, taskId],
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
