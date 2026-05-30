import type { ApprovalThreshold } from '@paperclip/shared-types';

export type ThresholdDimension = ApprovalThreshold['dimension'];

export interface ProposedAction {
  budget?: number;
  risk?: number;
  sensitivity?: number;
  authority?: number;
  scope?: string;
}

export interface EvaluationResult {
  approved: boolean;
  triggeredDimensions: ThresholdDimension[];
  reason: string;
}

const DEFAULT_THRESHOLDS: Record<ThresholdDimension, number> = {
  budget: 100,
  risk: 0.8,
  sensitivity: 0.7,
  authority: 0.5,
};

const DEFAULT_TIMEOUTS: Record<ThresholdDimension, number> = {
  budget: 30 * 60 * 1000,
  risk: 15 * 60 * 1000,
  sensitivity: 30 * 60 * 1000,
  authority: 30 * 60 * 1000,
};

let thresholds = new Map<ThresholdDimension, ApprovalThreshold>();
let initialized = false;

function ensureDefaults(): void {
  if (initialized) return;
  for (const [dim, val] of Object.entries(DEFAULT_THRESHOLDS)) {
    thresholds.set(dim as ThresholdDimension, {
      id: `default-${dim}`,
      dimension: dim as ThresholdDimension,
      value: val,
      timeoutMs: DEFAULT_TIMEOUTS[dim as ThresholdDimension],
      timeoutAction: 'auto_reject',
      scope: '',
    });
  }
  initialized = true;
}

export function setThreshold(threshold: ApprovalThreshold): void {
  ensureDefaults();
  thresholds.set(threshold.dimension, threshold);
}

export function getThresholds(): ApprovalThreshold[] {
  ensureDefaults();
  return Array.from(thresholds.values());
}

export function getThreshold(dimension: ThresholdDimension): ApprovalThreshold | undefined {
  ensureDefaults();
  return thresholds.get(dimension);
}

export function evaluateAction(action: ProposedAction): EvaluationResult {
  ensureDefaults();
  const triggered: ThresholdDimension[] = [];

  for (const dim of Object.keys(DEFAULT_THRESHOLDS) as ThresholdDimension[]) {
    const actionValue = action[dim];
    if (actionValue === undefined) continue;

    const threshold = thresholds.get(dim);
    if (!threshold) continue;

    // Scope filtering
    if (threshold.scope && action.scope && threshold.scope !== action.scope) continue;

    if (actionValue > threshold.value) {
      triggered.push(dim);
    }
  }

  const approved = triggered.length === 0;
  return {
    approved,
    triggeredDimensions: triggered,
    reason: approved
      ? 'All dimensions within thresholds'
      : `Exceeded thresholds: ${triggered.join(', ')}`,
  };
}

export function isAutoApproved(action: ProposedAction): boolean {
  return evaluateAction(action).approved;
}

export function resetThresholds(): void {
  thresholds.clear();
  initialized = false;
}
