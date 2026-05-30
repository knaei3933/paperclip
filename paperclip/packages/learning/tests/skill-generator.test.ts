import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkAndGenerateSkill,
  generateSkill,
  getSkills,
  getSkillById,
  SKILL_GENERATION_THRESHOLD,
} from '../src/skill-generator/skill-generator.service.js';
import { createMockDb, createMockEventBus } from './test-utils.js';

describe('SkillGenerator', () => {
  let db: ReturnType<typeof createMockDb>;
  let eventBus: ReturnType<typeof createMockEventBus>;

  const mockExperiences = [
    {
      id: 'exp-1', task_id: 't1', agent_id: 'agent-1',
      task_description: 'Build API', approach_taken: 'query and fetch data',
      result: null, success: true, time_taken_ms: 1000, token_cost: 50,
      department: 'engineering', task_type: 'development',
      lessons: ['Use indexed queries'], created_at: new Date().toISOString(),
    },
    {
      id: 'exp-2', task_id: 't2', agent_id: 'agent-1',
      task_description: 'Build API v2', approach_taken: 'query and fetch data',
      result: null, success: true, time_taken_ms: 1200, token_cost: 60,
      department: 'engineering', task_type: 'development',
      lessons: ['Cache results'], created_at: new Date().toISOString(),
    },
    {
      id: 'exp-3', task_id: 't3', agent_id: 'agent-1',
      task_description: 'Build API v3', approach_taken: 'query and fetch data',
      result: null, success: true, time_taken_ms: 800, token_cost: 40,
      department: 'engineering', task_type: 'development',
      lessons: ['Batch queries'], created_at: new Date().toISOString(),
    },
    {
      id: 'exp-4', task_id: 't4', agent_id: 'agent-1',
      task_description: 'Build API v4', approach_taken: 'query and validate',
      result: null, success: true, time_taken_ms: 900, token_cost: 45,
      department: 'engineering', task_type: 'development',
      lessons: ['Validate early'], created_at: new Date().toISOString(),
    },
    {
      id: 'exp-5', task_id: 't5', agent_id: 'agent-1',
      task_description: 'Build API v5', approach_taken: 'query and fetch data',
      result: null, success: true, time_taken_ms: 700, token_cost: 35,
      department: 'engineering', task_type: 'development',
      lessons: ['Minimize round trips'], created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    db = createMockDb();
    eventBus = createMockEventBus();
  });

  it('should not generate skill below threshold', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ count: 3 }] }; // below threshold
      }
      return { rows: [] };
    });

    const result = await checkAndGenerateSkill(db, eventBus, 'agent-1', 'engineering');
    expect(result).toBeNull();
  });

  it('should not generate skill if one already exists for domain', async () => {
    let callIdx = 0;
    db.pool.query = vi.fn(async (sql: string) => {
      callIdx++;
      if (sql.includes('COUNT(*)') && sql.includes('experiences')) {
        return { rows: [{ count: 10 }] }; // above threshold
      }
      if (sql.includes('SELECT * FROM agent_skills')) {
        return { rows: [{ id: 'existing-skill' }] }; // already exists
      }
      return { rows: [] };
    });

    const result = await checkAndGenerateSkill(db, eventBus, 'agent-1', 'engineering');
    expect(result).toBeNull();
  });

  it('should generate skill when threshold is met and no existing skill', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('COUNT(*)') && sql.includes('experiences')) {
        return { rows: [{ count: 5 }] };
      }
      if (sql.includes('SELECT * FROM agent_skills WHERE agent_id')) {
        return { rows: [] }; // no existing skill
      }
      if (sql.includes('SELECT * FROM experiences')) {
        return { rows: mockExperiences };
      }
      if (sql.includes('SELECT id FROM agent_memories')) {
        return { rows: [{ id: 'mem-1' }] };
      }
      if (sql.includes('INSERT INTO agent_skills')) {
        return {
          rows: [{
            id: 'skill-1',
            name: 'engineering-automation-skill',
            domain: 'engineering',
            description: 'Auto-generated skill',
            prompt_template: 'template',
            tool_sequence: ['database_query', 'api_call'],
            validation_criteria: ['criteria1'],
            success_rate: 1.0,
            usage_count: 0,
            agent_id: 'agent-1',
            applicable_contexts: ['engineering'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deprecated_at: null,
          }],
        };
      }
      return { rows: [] };
    });

    const result = await checkAndGenerateSkill(db, eventBus, 'agent-1', 'engineering');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('engineering-automation-skill');
    expect(eventBus.events).toHaveLength(1);
    expect(eventBus.events[0].type).toBe('SkillGenerated');
  });

  it('should use default threshold of 5', () => {
    expect(SKILL_GENERATION_THRESHOLD).toBe(5);
  });

  it('should generate skill with correct template from experiences', async () => {
    const properExperiences = mockExperiences.map((e) => ({
      id: e.id,
      taskId: e.task_id,
      agentId: e.agent_id,
      taskDescription: e.task_description,
      approachTaken: e.approach_taken,
      result: e.result,
      success: e.success,
      timeTakenMs: e.time_taken_ms,
      tokenCost: e.token_cost,
      department: e.department,
      taskType: e.task_type,
      lessons: e.lessons,
      createdAt: new Date(e.created_at),
    }));

    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id FROM agent_memories')) {
        return { rows: [{ id: 'mem-1' }] };
      }
      if (sql.includes('INSERT INTO agent_skills')) {
        return {
          rows: [{
            id: 'skill-gen-1',
            name: 'engineering-automation-skill',
            domain: 'engineering',
            description: 'Auto-generated',
            prompt_template: 'Execute engineering task',
            tool_sequence: ['database_query'],
            validation_criteria: ['criteria1'],
            success_rate: 1.0,
            usage_count: 0,
            agent_id: 'agent-1',
            applicable_contexts: ['engineering'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deprecated_at: null,
          }],
        };
      }
      return { rows: [] };
    });

    const result = await generateSkill(db, eventBus, properExperiences, 'agent-1', 'engineering');
    expect(result).toBeDefined();
    expect(result.name).toContain('automation');
    expect(result.promptTemplate).toContain('engineering');
    expect(result.toolSequence).toContain('database_query');
  });

  it('should return skills for an agent', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM agent_skills WHERE agent_id')) {
        return {
          rows: [
            {
              id: 'skill-1', name: 'test-skill', domain: 'eng',
              description: '', prompt_template: '', tool_sequence: [],
              validation_criteria: [], success_rate: 0.8, usage_count: 5,
              agent_id: 'agent-1', applicable_contexts: ['eng'],
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              deprecated_at: null,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const skills = await getSkills(db, 'agent-1');
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('test-skill');
  });

  it('should get a skill by id', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM agent_skills WHERE id')) {
        return {
          rows: [{
            id: 'skill-1', name: 'test-skill', domain: 'eng',
            description: '', prompt_template: '', tool_sequence: [],
            validation_criteria: [], success_rate: 0.8, usage_count: 5,
            agent_id: 'agent-1', applicable_contexts: ['eng'],
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            deprecated_at: null,
          }],
        };
      }
      return { rows: [] };
    });

    const skill = await getSkillById(db, 'skill-1');
    expect(skill).not.toBeNull();
    expect(skill!.id).toBe('skill-1');
  });

  it('should return null for non-existent skill id', async () => {
    db.pool.query = vi.fn(async () => ({ rows: [] }));

    const skill = await getSkillById(db, 'non-existent');
    expect(skill).toBeNull();
  });
});
