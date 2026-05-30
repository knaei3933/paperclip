import { describe, it, expect, beforeEach } from 'vitest';
import {
  setThreshold,
  getThresholds,
  getThreshold,
  evaluateAction,
  isAutoApproved,
  resetThresholds,
} from '@paperclip/core';

describe('Governance - Threshold Evaluation', () => {
  beforeEach(() => {
    resetThresholds();
  });

  it('auto-approves actions within all thresholds', () => {
    const result = evaluateAction({ budget: 50, risk: 0.3 });
    expect(result.approved).toBe(true);
    expect(result.triggeredDimensions).toEqual([]);
    expect(result.reason).toContain('within thresholds');
  });

  it('escalates when budget exceeds threshold', () => {
    const result = evaluateAction({ budget: 200 });
    expect(result.approved).toBe(false);
    expect(result.triggeredDimensions).toContain('budget');
  });

  it('escalates when risk exceeds threshold', () => {
    const result = evaluateAction({ risk: 0.9 });
    expect(result.approved).toBe(false);
    expect(result.triggeredDimensions).toContain('risk');
  });

  it('escalates on multiple dimensions exceeding thresholds', () => {
    const result = evaluateAction({ budget: 200, risk: 0.9 });
    expect(result.approved).toBe(false);
    expect(result.triggeredDimensions).toContain('budget');
    expect(result.triggeredDimensions).toContain('risk');
    expect(result.reason).toContain('budget');
    expect(result.reason).toContain('risk');
  });

  it('respects custom thresholds after setThreshold', async () => {
    await setThreshold({
      id: 'custom-budget',
      dimension: 'budget',
      value: 500,
      timeoutMs: 60000,
      timeoutAction: 'auto_reject',
      scope: '',
    });

    const result = evaluateAction({ budget: 200 });
    expect(result.approved).toBe(true);

    const result2 = evaluateAction({ budget: 600 });
    expect(result2.approved).toBe(false);
  });

  it('isAutoApproved returns boolean correctly', () => {
    expect(isAutoApproved({ budget: 10 })).toBe(true);
    expect(isAutoApproved({ budget: 200 })).toBe(false);
  });

  it('getThresholds returns all four dimensions', () => {
    const thresholds = getThresholds();
    expect(thresholds).toHaveLength(4);
    const dims = thresholds.map((t) => t.dimension).sort();
    expect(dims).toEqual(['authority', 'budget', 'risk', 'sensitivity']);
  });

  it('getThreshold returns specific dimension', () => {
    const budget = getThreshold('budget');
    expect(budget).toBeDefined();
    expect(budget!.dimension).toBe('budget');
  });

  it('ignores scope mismatch for scoped thresholds', async () => {
    await setThreshold({
      id: 'scoped-budget',
      dimension: 'budget',
      value: 10,
      timeoutMs: 60000,
      timeoutAction: 'auto_reject',
      scope: 'finance',
    });

    // Action with different scope does NOT match the scoped threshold (value=10)
    // Default threshold (value=100) still applies, budget=50 < 100 => approved
    const result = evaluateAction({ budget: 50, scope: 'engineering' });
    expect(result.approved).toBe(true);

    // Same scope matches the scoped threshold, budget=50 > 10 => escalate
    const scopedResult = evaluateAction({ budget: 50, scope: 'finance' });
    expect(scopedResult.approved).toBe(false);
    expect(scopedResult.triggeredDimensions).toContain('budget');
  });
});
