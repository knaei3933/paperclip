import type { CostModel } from './cost-model.js';

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

const agentBudgets = new Map<string, BudgetRecord>();
const taskBudgets = new Map<string, BudgetRecord>();

export function allocateBudget(
  agentId: string,
  taskId: string,
  limit: number,
): BudgetRecord {
  const record: BudgetRecord = { agentId, taskId, limit, spent: 0 };
  taskBudgets.set(taskId, record);
  // Also track per-agent cumulative
  const existing = agentBudgets.get(agentId);
  if (existing) {
    existing.limit += limit;
  } else {
    agentBudgets.set(agentId, { agentId, taskId: '', limit, spent: 0 });
  }
  return record;
}

export function trackSpend(agentId: string, taskId: string, cost: number): void {
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
  agentBudgets.clear();
  taskBudgets.clear();
}
