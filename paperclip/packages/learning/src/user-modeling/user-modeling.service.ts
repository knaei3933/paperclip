import type { Pool } from 'pg';

export interface DbPool {
  pool: Pool;
}

export interface ApprovalDecision {
  id: string;
  escalationId: string;
  approved: boolean;
  agentId: string | null;
  createdAt: Date;
}

export interface ApprovalPattern {
  totalDecisions: number;
  approvalRate: number;
  approvalByAgent: Map<string, { approved: number; rejected: number }>;
  approvalByUrgency: Map<string, { approved: number; rejected: number }>;
}

export interface PreferenceModel {
  approvalRate: number;
  rejectionSensitivity: number;
  agentReliabilityScores: Map<string, number>;
}

/**
 * Record a CEO approval/rejection decision on an escalation.
 */
export async function recordApprovalDecision(
  db: DbPool,
  escalationId: string,
  approved: boolean,
  agentId?: string,
): Promise<ApprovalDecision> {
  const { pool } = db;

  const result = await pool.query(
    `INSERT INTO approval_decisions (escalation_id, approved, agent_id)
     VALUES ($1, $2, $3)
     RETURNING id, escalation_id, approved, agent_id, created_at`,
    [escalationId, approved, agentId ?? null],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    escalationId: row.escalation_id,
    approved: row.approved,
    agentId: row.agent_id,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Get aggregated approval patterns across all escalation decisions.
 */
export async function getApprovalPatterns(db: DbPool): Promise<ApprovalPattern> {
  const { pool } = db;

  const result = await pool.query(
    `SELECT
       COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE approved = true)::int as approved_count,
       agent_id
     FROM approval_decisions
     GROUP BY agent_id`,
  );

  let totalDecisions = 0;
  let totalApproved = 0;
  const approvalByAgent = new Map<string, { approved: number; rejected: number }>();

  for (const row of result.rows) {
    const count = row.total;
    const approved = row.approved_count;
    totalDecisions += count;
    totalApproved += approved;

    const agentKey = row.agent_id ?? 'unknown';
    approvalByAgent.set(agentKey, {
      approved,
      rejected: count - approved,
    });
  }

  // Also get by urgency via join
  const urgencyResult = await pool.query(
    `SELECT e.urgency, COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE ad.approved = true)::int as approved_count
     FROM approval_decisions ad
     JOIN escalation_requests e ON ad.escalation_id = e.id
     GROUP BY e.urgency`,
  );

  const approvalByUrgency = new Map<string, { approved: number; rejected: number }>();
  for (const row of urgencyResult.rows) {
    const total = row.total;
    const approved = row.approved_count;
    approvalByUrgency.set(row.urgency, {
      approved,
      rejected: total - approved,
    });
  }

  return {
    totalDecisions,
    approvalRate: totalDecisions > 0 ? totalApproved / totalDecisions : 0,
    approvalByAgent,
    approvalByUrgency,
  };
}

/**
 * Build a preference model from approval patterns.
 */
export async function getPreferenceModel(db: DbPool): Promise<PreferenceModel> {
  const patterns = await getApprovalPatterns(db);

  const agentReliabilityScores = new Map<string, number>();
  for (const [agentId, stats] of patterns.approvalByAgent) {
    const total = stats.approved + stats.rejected;
    agentReliabilityScores.set(agentId, total > 0 ? stats.approved / total : 0.5);
  }

  return {
    approvalRate: patterns.approvalRate,
    rejectionSensitivity: patterns.totalDecisions > 0
      ? (1 - patterns.approvalRate)
      : 0.5,
    agentReliabilityScores,
  };
}

/**
 * Adjust escalation sensitivity for an agent based on their reliability.
 * Higher reliability -> lower sensitivity (less likely to escalate).
 * Lower reliability -> higher sensitivity (more likely to escalate).
 */
export async function adjustEscalationSensitivity(
  db: DbPool,
  agentId: string,
): Promise<number> {
  const model = await getPreferenceModel(db);
  const reliability = model.agentReliabilityScores.get(agentId) ?? 0.5;

  // Sensitivity is inversely proportional to reliability
  // Range: 0.1 (very reliable, low sensitivity) to 1.0 (unreliable, high sensitivity)
  const sensitivity = Math.max(0.1, Math.min(1.0, 1.0 - reliability + 0.1));

  return sensitivity;
}
