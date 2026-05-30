import { describe, it, expect, beforeEach } from 'vitest';
import {
  allocateBudget,
  trackSpend,
  checkBudget,
  getBudgetUtilization,
  convertTokensToCost,
  resetBudgets,
} from '../../core/src/budget/budget.service.js';
import type { CostModel } from '../../core/src/budget/cost-model.js';

describe('Budget Service', () => {
  beforeEach(() => {
    resetBudgets();
  });

  it('allocates budget for a task and agent', async () => {
    const record = await allocateBudget('agent-1', 'task-1', 10.0);
    expect(record.limit).toBe(10.0);
    expect(record.spent).toBe(0);
    expect(record.agentId).toBe('agent-1');
    expect(record.taskId).toBe('task-1');
  });

  it('tracks spend and reduces remaining budget', async () => {
    await allocateBudget('agent-1', 'task-1', 10.0);
    await trackSpend('agent-1', 'task-1', 3.0);
    await trackSpend('agent-1', 'task-1', 2.0);

    const budget = checkBudget('agent-1', 'task-1');
    expect(budget.remaining).toBeCloseTo(5.0);
    expect(budget.allowed).toBe(true);
  });

  it('blocks execution when budget is exhausted', async () => {
    await allocateBudget('agent-1', 'task-1', 5.0);
    await trackSpend('agent-1', 'task-1', 5.0);

    const budget = checkBudget('agent-1', 'task-1');
    expect(budget.allowed).toBe(false);
    expect(budget.remaining).toBeLessThanOrEqual(0);
  });

  it('converts token usage to cost using CostModel', () => {
    const model: CostModel = {
      promptCostPer1K: 0.003,
      completionCostPer1K: 0.015,
    };
    const cost = convertTokensToCost(
      { prompt: 1_000, completion: 1_000, total: 2_000 },
      model,
    );
    // 1K prompt * $0.003 + 1K completion * $0.015 = $0.018
    expect(cost).toBeCloseTo(0.018);
  });

  it('calculates budget utilization', async () => {
    await allocateBudget('agent-1', 'task-1', 10.0);
    await allocateBudget('agent-1', 'task-2', 20.0);
    await trackSpend('agent-1', 'task-1', 5.0);
    await trackSpend('agent-1', 'task-2', 10.0);

    const util = getBudgetUtilization('agent-1');
    expect(util.agentUtilization).toBeCloseTo(0.5);
    expect(util.taskUtilization.get('task-1')).toBeCloseTo(0.5);
    expect(util.taskUtilization.get('task-2')).toBeCloseTo(0.5);
  });

  it('handles unknown agent/task gracefully', () => {
    const budget = checkBudget('unknown-agent', 'unknown-task');
    expect(budget.allowed).toBe(true); // No budget = infinite remaining
    expect(budget.remaining).toBe(Infinity);
  });
});
