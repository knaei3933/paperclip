import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateSkillSuccessRate,
  checkRefinementNeeded,
  refineSkill,
  deprecateSkill,
  REFINEMENT_THRESHOLD,
  DEPRECATION_MAX_FAILURES,
} from '../src/skill-refinement/skill-refinement.service.js';
import { createMockDb, createMockEventBus } from './test-utils.js';

describe('SkillRefinement', () => {
  let db: ReturnType<typeof createMockDb>;
  let eventBus: ReturnType<typeof createMockEventBus>;

  const mockSkillRow = {
    id: 'skill-1',
    name: 'test-skill',
    domain: 'engineering',
    description: '',
    prompt_template: '',
    tool_sequence: [],
    validation_criteria: [],
    success_rate: 0.9,
    usage_count: 10,
    agent_id: 'agent-1',
    applicable_contexts: ['engineering'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deprecated_at: null,
  };

  beforeEach(() => {
    db = createMockDb();
    eventBus = createMockEventBus();
  });

  it('should update skill success rate based on application history', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('COUNT(*)') && sql.includes('skill_applications')) {
        return { rows: [{ total: 10, successes: 7 }] };
      }
      if (sql.includes('UPDATE agent_skills SET success_rate')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT * FROM agent_skills WHERE id')) {
        return { rows: [{ ...mockSkillRow, success_rate: 0.7 }] };
      }
      return { rows: [] };
    });

    const skill = await updateSkillSuccessRate(db, 'skill-1', false);

    expect(skill).not.toBeNull();
    expect(skill!.successRate).toBe(0.7);
  });

  it('should detect refinement needed when success rate drops below threshold', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT success_rate FROM agent_skills')) {
        return { rows: [{ success_rate: 0.3 }] }; // below 0.5
      }
      if (sql.includes('skill_applications') && sql.includes('ORDER BY')) {
        return { rows: [{ success: true }, { success: true }, { success: true }] };
      }
      return { rows: [] };
    });

    const status = await checkRefinementNeeded(db, 'skill-1');

    expect(status.needsRefinement).toBe(true);
    expect(status.needsDeprecation).toBe(false);
    expect(status.successRate).toBe(0.3);
  });

  it('should detect deprecation needed when all recent applications failed', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT success_rate FROM agent_skills')) {
        return { rows: [{ success_rate: 0 }] };
      }
      if (sql.includes('skill_applications') && sql.includes('ORDER BY')) {
        return { rows: [{ success: false }, { success: false }, { success: false }] };
      }
      return { rows: [] };
    });

    const status = await checkRefinementNeeded(db, 'skill-1');

    expect(status.needsDeprecation).toBe(true);
  });

  it('should not flag deprecation when recent results are mixed', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT success_rate FROM agent_skills')) {
        return { rows: [{ success_rate: 0.4 }] };
      }
      if (sql.includes('skill_applications') && sql.includes('ORDER BY')) {
        return { rows: [{ success: true }, { success: false }, { success: false }] };
      }
      return { rows: [] };
    });

    const status = await checkRefinementNeeded(db, 'skill-1');

    expect(status.needsDeprecation).toBe(false);
  });

  it('should refine skill by resetting statistics', async () => {
    let selectCount = 0;
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM agent_skills WHERE id')) {
        selectCount++;
        if (selectCount === 1) {
          return { rows: [mockSkillRow] };
        }
        // Final SELECT after update and delete
        return { rows: [{ ...mockSkillRow, success_rate: 0.5, usage_count: 0 }] };
      }
      if (sql.includes('UPDATE agent_skills')) {
        return { rows: [] };
      }
      if (sql.includes('DELETE FROM skill_applications')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const skill = await refineSkill(db, 'skill-1');
    expect(skill).not.toBeNull();
    expect(skill!.successRate).toBe(0.5);
    expect(skill!.usageCount).toBe(0);
  });

  it('should deprecate skill and emit SkillDeprecated event', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('UPDATE agent_skills SET deprecated_at')) {
        return { rows: [{ ...mockSkillRow, deprecated_at: new Date().toISOString() }] };
      }
      return { rows: [] };
    });

    const skill = await deprecateSkill(db, eventBus, 'skill-1', 'Consistent failure');

    expect(skill).not.toBeNull();
    expect(skill!.deprecatedAt).not.toBeNull();
    expect(eventBus.events).toHaveLength(1);
    expect(eventBus.events[0].type).toBe('SkillDeprecated');
    expect(eventBus.events[0].payload.reason).toBe('Consistent failure');
  });

  it('should have correct constants', () => {
    expect(REFINEMENT_THRESHOLD).toBe(0.5);
    expect(DEPRECATION_MAX_FAILURES).toBe(3);
  });
});
