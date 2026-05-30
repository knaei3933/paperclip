import type { ApprovalThreshold } from '@paperclip/shared-types';
import type { Pool } from 'pg';

export type ThresholdDimension = ApprovalThreshold['dimension'];

export interface DbPool {
  pool: Pool;
}

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
let dbPool: Pool | null = null;

export async function initGovernanceService(db: DbPool): Promise<void> {
  dbPool = db.pool;
  thresholds.clear();

  const result = await dbPool.query<{
    id: string;
    dimension: ThresholdDimension;
    value: string;
    timeout_ms: number;
    timeout_action: string;
    scope: string;
  }>('SELECT id, dimension, value, timeout_ms, timeout_action, scope FROM approval_thresholds');

  if (result.rows.length === 0) {
    // Insert defaults
    for (const [dim, val] of Object.entries(DEFAULT_THRESHOLDS)) {
      const threshold: ApprovalThreshold = {
        id: `default-${dim}`,
        dimension: dim as ThresholdDimension,
        value: val,
        timeoutMs: DEFAULT_TIMEOUTS[dim as ThresholdDimension],
        timeoutAction: 'auto_reject',
        scope: '',
      };
      await dbPool.query(
        'INSERT INTO approval_thresholds (dimension, value, timeout_ms, timeout_action, scope) VALUES ($1, $2, $3, $4, $5)',
        [threshold.dimension, threshold.value, threshold.timeoutMs, threshold.timeoutAction, threshold.scope],
      );
      thresholds.set(threshold.dimension, threshold);
    }
  } else {
    for (const row of result.rows) {
      thresholds.set(row.dimension, {
        id: row.id,
        dimension: row.dimension,
        value: Number(row.value),
        timeoutMs: row.timeout_ms,
        timeoutAction: row.timeout_action as ApprovalThreshold['timeoutAction'],
        scope: row.scope,
      });
    }
  }

  initialized = true;
}

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

export async function setThreshold(threshold: ApprovalThreshold): Promise<void> {
  ensureDefaults();
  thresholds.set(threshold.dimension, threshold);

  if (dbPool) {
    await dbPool.query(
      `DELETE FROM approval_thresholds WHERE dimension = $1`,
      [threshold.dimension],
    );
    await dbPool.query(
      `INSERT INTO approval_thresholds (dimension, value, timeout_ms, timeout_action, scope)
       VALUES ($1, $2, $3, $4, $5)`,
      [threshold.dimension, threshold.value, threshold.timeoutMs, threshold.timeoutAction, threshold.scope],
    );
  }
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
