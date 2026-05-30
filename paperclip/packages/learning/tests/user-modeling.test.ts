import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordApprovalDecision,
  getApprovalPatterns,
  getPreferenceModel,
  adjustEscalationSensitivity,
} from '../src/user-modeling/user-modeling.service.js';
import { createMockDb } from './test-utils.js';

describe('UserModeling', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('recordApprovalDecision', () => {
    it('should record an approval decision and return it', async () => {
      db.pool.query = vi.fn(async () => ({
        rows: [{
          id: 'dec-1',
          escalation_id: 'esc-1',
          approved: true,
          agent_id: 'agent-1',
          created_at: new Date().toISOString(),
        }],
      }));

      const decision = await recordApprovalDecision(db, 'esc-1', true, 'agent-1');
      expect(decision.id).toBe('dec-1');
      expect(decision.escalationId).toBe('esc-1');
      expect(decision.approved).toBe(true);
      expect(decision.agentId).toBe('agent-1');
    });

    it('should use null agent_id when not provided', async () => {
      const queryFn = vi.fn(async () => ({
        rows: [{
          id: 'dec-2',
          escalation_id: 'esc-2',
          approved: false,
          agent_id: null,
          created_at: new Date().toISOString(),
        }],
      }));
      db.pool.query = queryFn;

      const decision = await recordApprovalDecision(db, 'esc-2', false);
      expect(decision.agentId).toBeNull();

      const params = queryFn.mock.calls[0][1] as unknown[];
      expect(params).toContain(null);
    });
  });

  describe('getApprovalPatterns', () => {
    it('should compute approval patterns from decisions', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('GROUP BY agent_id')) {
          return {
            rows: [
              { total: 5, approved_count: 3, agent_id: 'agent-1' },
              { total: 2, approved_count: 1, agent_id: 'agent-2' },
            ],
          };
        }
        if (sql.includes('JOIN escalation_requests')) {
          return {
            rows: [
              { urgency: 'high', total: 3, approved_count: 2 },
              { urgency: 'low', total: 4, approved_count: 2 },
            ],
          };
        }
        return { rows: [] };
      });

      const patterns = await getApprovalPatterns(db);
      expect(patterns.totalDecisions).toBe(7);
      expect(patterns.approvalRate).toBeCloseTo(4 / 7);
      expect(patterns.approvalByAgent.get('agent-1')).toEqual({ approved: 3, rejected: 2 });
      expect(patterns.approvalByAgent.get('agent-2')).toEqual({ approved: 1, rejected: 1 });
    });

    it('should handle empty data', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      const patterns = await getApprovalPatterns(db);
      expect(patterns.totalDecisions).toBe(0);
      expect(patterns.approvalRate).toBe(0);
    });

    it('should group approval by urgency', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('GROUP BY agent_id')) {
          return { rows: [{ total: 5, approved_count: 3, agent_id: null }] };
        }
        if (sql.includes('JOIN escalation_requests')) {
          return {
            rows: [
              { urgency: 'critical', total: 2, approved_count: 1 },
            ],
          };
        }
        return { rows: [] };
      });

      const patterns = await getApprovalPatterns(db);
      expect(patterns.approvalByUrgency.get('critical')).toEqual({ approved: 1, rejected: 1 });
    });

    it('should use "unknown" key for null agent_id', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('GROUP BY agent_id')) {
          return { rows: [{ total: 3, approved_count: 2, agent_id: null }] };
        }
        if (sql.includes('JOIN escalation_requests')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const patterns = await getApprovalPatterns(db);
      expect(patterns.approvalByAgent.get('unknown')).toEqual({ approved: 2, rejected: 1 });
    });
  });

  describe('getPreferenceModel', () => {
    it('should build preference model from patterns', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('GROUP BY agent_id')) {
          return {
            rows: [
              { total: 10, approved_count: 8, agent_id: 'agent-1' },
              { total: 10, approved_count: 3, agent_id: 'agent-2' },
            ],
          };
        }
        if (sql.includes('JOIN escalation_requests')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const model = await getPreferenceModel(db);
      expect(model.approvalRate).toBeCloseTo(11 / 20);
      expect(model.rejectionSensitivity).toBeCloseTo(9 / 20);
      expect(model.agentReliabilityScores.get('agent-1')).toBeCloseTo(0.8);
      expect(model.agentReliabilityScores.get('agent-2')).toBeCloseTo(0.3);
    });

    it('should use 0.5 default sensitivity with no data', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      const model = await getPreferenceModel(db);
      expect(model.approvalRate).toBe(0);
      expect(model.rejectionSensitivity).toBe(0.5);
    });

    it('should handle agents with no decisions (zero total)', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('GROUP BY agent_id')) {
          return { rows: [{ total: 0, approved_count: 0, agent_id: 'agent-0' }] };
        }
        if (sql.includes('JOIN escalation_requests')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const model = await getPreferenceModel(db);
      expect(model.agentReliabilityScores.get('agent-0')).toBe(0.5);
    });
  });

  describe('adjustEscalationSensitivity', () => {
    it('should return lower sensitivity for reliable agents', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('GROUP BY agent_id')) {
          return { rows: [{ total: 10, approved_count: 9, agent_id: 'agent-1' }] };
        }
        if (sql.includes('JOIN escalation_requests')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const sensitivity = await adjustEscalationSensitivity(db, 'agent-1');
      expect(sensitivity).toBeLessThan(0.3);
    });

    it('should return higher sensitivity for unreliable agents', async () => {
      db.pool.query = vi.fn(async (sql: string) => {
        if (sql.includes('GROUP BY agent_id')) {
          return { rows: [{ total: 10, approved_count: 1, agent_id: 'agent-2' }] };
        }
        if (sql.includes('JOIN escalation_requests')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const sensitivity = await adjustEscalationSensitivity(db, 'agent-2');
      expect(sensitivity).toBeGreaterThan(0.8);
    });

    it('should clamp sensitivity between 0.1 and 1.0', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      const sensitivity = await adjustEscalationSensitivity(db, 'unknown-agent');
      expect(sensitivity).toBeGreaterThanOrEqual(0.1);
      expect(sensitivity).toBeLessThanOrEqual(1.0);
    });
  });
});
