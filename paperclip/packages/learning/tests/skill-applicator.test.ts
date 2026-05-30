import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applySkills, recordSkillApplication, getSkillApplicatorContext } from '../src/skill-applicator/skill-applicator.service.js';
import { createMockDb, createMockEventBus } from './test-utils.js';

describe('SkillApplicator', () => {
  let db: ReturnType<typeof createMockDb>;
  let eventBus: ReturnType<typeof createMockEventBus>;

  const mockSkill = {
    id: 'skill-1',
    name: 'engineering-automation-skill',
    domain: 'engineering',
    description: 'Auto-generated skill',
    prompt_template: 'Execute engineering task using standard approach',
    tool_sequence: ['database_query', 'api_call'],
    validation_criteria: ['time under 1200ms'],
    success_rate: 0.9,
    usage_count: 10,
    agent_id: 'agent-1',
    applicable_contexts: ['engineering'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deprecated_at: null,
  };

  const taskContext = {
    taskId: 'task-1',
    agentId: 'agent-1',
    description: 'Build a REST API endpoint',
    department: 'engineering',
  };

  beforeEach(() => {
    db = createMockDb();
    eventBus = createMockEventBus();
  });

  it('should return enriched context when matching skill exists', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM agent_skills')) {
        return { rows: [mockSkill] };
      }
      return { rows: [] };
    });

    const context = await applySkills(db, taskContext);

    expect(context.skillApplied).toBe(true);
    expect(context.skillId).toBe('skill-1');
    expect(context.enrichedPrompt).toContain('Skill Context');
    expect(context.enrichedPrompt).toContain('Build a REST API endpoint');
    expect(context.toolHints).toEqual(['database_query', 'api_call']);
  });

  it('should return empty context when no matching skill', async () => {
    db.pool.query = vi.fn(async () => ({ rows: [] }));

    const context = await applySkills(db, taskContext);

    expect(context.skillApplied).toBe(false);
    expect(context.skillId).toBeUndefined();
    expect(context.enrichedPrompt).toBe('Build a REST API endpoint');
    expect(context.toolHints).toEqual([]);
  });

  it('should return empty context when no department specified', async () => {
    const noDept = { ...taskContext, department: undefined, taskType: undefined };
    const context = await applySkills(db, noDept);

    expect(context.skillApplied).toBe(false);
  });

  it('should record skill application and emit SkillApplied event', async () => {
    let queryCalls = 0;
    db.pool.query = vi.fn(async () => {
      queryCalls++;
      return { rows: [] };
    });

    await recordSkillApplication(db, eventBus, 'skill-1', 'task-1', 'agent-1', true);

    // Two queries: INSERT INTO skill_applications + UPDATE usage_count
    expect(queryCalls).toBe(2);
    expect(eventBus.events).toHaveLength(1);
    expect(eventBus.events[0].type).toBe('SkillApplied');
    expect(eventBus.events[0].payload).toEqual({
      skillId: 'skill-1',
      taskId: 'task-1',
      success: true,
    });
  });

  it('should use task type as fallback domain match', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM agent_skills')) {
        return { rows: [mockSkill] };
      }
      return { rows: [] };
    });

    const context = await applySkills(db, {
      ...taskContext,
      department: undefined,
      taskType: 'engineering',
    });

    expect(context.skillApplied).toBe(true);
  });

  it('should delegate getSkillApplicatorContext to applySkills', async () => {
    db.pool.query = vi.fn(async () => ({ rows: [mockSkill] }));

    const context = await getSkillApplicatorContext(db, taskContext);
    expect(context.skillApplied).toBe(true);
    expect(context.skillId).toBe('skill-1');
  });
});
