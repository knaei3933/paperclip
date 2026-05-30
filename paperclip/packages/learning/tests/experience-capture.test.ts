import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureExperience, getExperiences, getExperienceCount } from '../src/experience-capture/experience-capture.service.js';
import { createMockDb, createMockEventBus } from './test-utils.js';

describe('ExperienceCapture', () => {
  let db: ReturnType<typeof createMockDb>;
  let eventBus: ReturnType<typeof createMockEventBus>;

  const baseInput = {
    taskId: 'task-1',
    agentId: 'agent-1',
    taskDescription: 'Build a REST API',
    approachTaken: 'standard',
    result: { status: 'done' },
    success: true,
    timeTakenMs: 5000,
    tokenCost: 100,
    department: 'engineering',
    taskType: 'development',
  };

  beforeEach(() => {
    db = createMockDb();
    eventBus = createMockEventBus();
  });

  it('should capture a successful experience and emit ExperienceCaptured event', async () => {
    // Mock: find memory, then insert
    let callIdx = 0;
    db.pool.query = vi.fn(async (sql: string) => {
      callIdx++;
      if (sql.includes('SELECT id FROM agent_memories')) {
        return { rows: [{ id: 'mem-1' }] };
      }
      // INSERT INTO experiences
      return {
        rows: [{
          id: 'exp-1',
          task_id: 'task-1',
          agent_id: 'agent-1',
          task_description: 'Build a REST API',
          approach_taken: 'standard',
          result: { status: 'done' },
          success: true,
          time_taken_ms: 5000,
          token_cost: 100,
          department: 'engineering',
          task_type: 'development',
          lessons: ['Approach "standard" succeeded for development'],
          created_at: new Date().toISOString(),
        }],
      };
    });

    const record = await captureExperience(db, eventBus, baseInput);

    expect(record.id).toBe('exp-1');
    expect(record.taskId).toBe('task-1');
    expect(record.success).toBe(true);
    expect(record.lessons).toHaveLength(1);
    expect(eventBus.events).toHaveLength(1);
    expect(eventBus.events[0].type).toBe('ExperienceCaptured');
  });

  it('should create a memory record if none exists for agent', async () => {
    let callIdx = 0;
    db.pool.query = vi.fn(async (sql: string) => {
      callIdx++;
      if (sql.includes('SELECT id FROM agent_memories') && callIdx === 1) {
        return { rows: [] }; // no memory
      }
      if (sql.includes('INSERT INTO agent_memories')) {
        return { rows: [{ id: 'mem-new' }] };
      }
      return {
        rows: [{
          id: 'exp-2',
          task_id: 'task-1',
          agent_id: 'agent-1',
          task_description: '',
          approach_taken: 'standard',
          result: null,
          success: true,
          time_taken_ms: 0,
          token_cost: 0,
          department: '',
          task_type: '',
          lessons: [],
          created_at: new Date().toISOString(),
        }],
      };
    });

    const record = await captureExperience(db, eventBus, {
      ...baseInput,
      lessons: ['custom lesson'],
    });
    expect(record.id).toBe('exp-2');
  });

  it('should retrieve experiences for an agent with filters', async () => {
    db.pool.query = vi.fn(async () => ({
      rows: [
        {
          id: 'exp-1',
          task_id: 'task-1',
          agent_id: 'agent-1',
          task_description: 'Test task',
          approach_taken: 'standard',
          result: null,
          success: true,
          time_taken_ms: 100,
          token_cost: 10,
          department: 'engineering',
          task_type: 'test',
          lessons: ['lesson1'],
          created_at: new Date().toISOString(),
        },
      ],
    }));

    const experiences = await getExperiences(db, 'agent-1', {
      success: true,
      department: 'engineering',
    });

    expect(experiences).toHaveLength(1);
    expect(experiences[0].agentId).toBe('agent-1');
  });

  it('should return experience count for an agent', async () => {
    db.pool.query = vi.fn(async () => ({
      rows: [{ count: 42 }],
    }));

    const count = await getExperienceCount(db, 'agent-1');
    expect(count).toBe(42);
  });

  it('should generate failure lessons when task is not successful', async () => {
    db.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id FROM agent_memories')) {
        return { rows: [{ id: 'mem-1' }] };
      }
      return {
        rows: [{
          id: 'exp-fail',
          task_id: 'task-2',
          agent_id: 'agent-1',
          task_description: 'Failed task',
          approach_taken: 'experimental',
          result: null,
          success: false,
          time_taken_ms: 3000,
          token_cost: 50,
          department: 'engineering',
          task_type: 'test',
          lessons: ['Approach "experimental" failed for test'],
          created_at: new Date().toISOString(),
        }],
      };
    });

    const record = await captureExperience(db, eventBus, {
      ...baseInput,
      success: false,
      approachTaken: 'experimental',
    });

    expect(record.success).toBe(false);
    expect(record.lessons[0]).toContain('failed');
  });
});
