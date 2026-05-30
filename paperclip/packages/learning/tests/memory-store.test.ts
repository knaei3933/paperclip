import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchExperiences, getRelevantExperiences, summarizeExperiences } from '../src/memory-store/memory-store.service.js';
import { createMockDb } from './test-utils.js';

describe('MemoryStore', () => {
  let db: ReturnType<typeof createMockDb>;

  const mockExperienceRow = {
    id: 'exp-1',
    task_id: 'task-1',
    agent_id: 'agent-1',
    task_description: 'Build a REST API',
    approach_taken: 'standard',
    result: null,
    success: true,
    time_taken_ms: 1000,
    token_cost: 50,
    department: 'engineering',
    task_type: 'development',
    lessons: ['Use indexed queries'],
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    db = createMockDb();
  });

  describe('searchExperiences', () => {
    it('should search experiences using full-text search', async () => {
      db.pool.query = vi.fn(async () => ({
        rows: [{ ...mockExperienceRow, total_count: 1 }],
      }));

      const result = await searchExperiences(db, 'REST API', 'agent-1');

      expect(result.experiences).toHaveLength(1);
      expect(result.totalMatches).toBe(1);
      expect(result.experiences[0].taskDescription).toBe('Build a REST API');
    });

    it('should return empty results when no matches', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      const result = await searchExperiences(db, 'nonexistent', 'agent-1');
      expect(result.experiences).toHaveLength(0);
      expect(result.totalMatches).toBe(0);
    });

    it('should join multi-word queries with &', async () => {
      const queryFn = vi.fn(async () => ({ rows: [] }));
      db.pool.query = queryFn;

      await searchExperiences(db, 'REST API endpoint', 'agent-1');

      const params = queryFn.mock.calls[0][1] as unknown[];
      expect(params[1]).toBe('REST & API & endpoint');
    });

    it('should use custom limit', async () => {
      const queryFn = vi.fn(async () => ({ rows: [] }));
      db.pool.query = queryFn;

      await searchExperiences(db, 'test', 'agent-1', 5);

      const params = queryFn.mock.calls[0][1] as unknown[];
      expect(params).toContain(5);
    });
  });

  describe('getRelevantExperiences', () => {
    it('should return FTS matches when available', async () => {
      db.pool.query = vi.fn(async () => ({
        rows: [mockExperienceRow],
      }));

      const experiences = await getRelevantExperiences(db, 'Build REST API', 'agent-1');
      expect(experiences).toHaveLength(1);
      expect(experiences[0].id).toBe('exp-1');
    });

    it('should fall back to recent experiences when no FTS match', async () => {
      let callIdx = 0;
      db.pool.query = vi.fn(async () => {
        callIdx++;
        if (callIdx === 1) {
          return { rows: [] }; // no FTS match
        }
        return { rows: [mockExperienceRow] }; // fallback
      });

      const experiences = await getRelevantExperiences(db, 'Build REST API', 'agent-1');
      expect(experiences).toHaveLength(1);
    });

    it('should fall back when keywords are too short', async () => {
      let callIdx = 0;
      db.pool.query = vi.fn(async () => {
        callIdx++;
        // Both calls are fallback since keywords are short
        return { rows: [mockExperienceRow] };
      });

      const experiences = await getRelevantExperiences(db, 'ab', 'agent-1');
      expect(experiences.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('summarizeExperiences', () => {
    it('should return empty string for empty array', () => {
      expect(summarizeExperiences([])).toBe('');
    });

    it('should summarize successful experiences', () => {
      const experiences = [
        {
          id: 'exp-1',
          taskId: 'task-1',
          agentId: 'agent-1',
          taskDescription: 'Build API',
          approachTaken: 'standard',
          result: null,
          success: true,
          timeTakenMs: 1000,
          tokenCost: 50,
          department: 'eng',
          taskType: 'dev',
          lessons: ['Use caching'],
          createdAt: new Date(),
        },
      ];

      const summary = summarizeExperiences(experiences);
      expect(summary).toContain('SUCCESS');
      expect(summary).toContain('Build API');
      expect(summary).toContain('standard');
      expect(summary).toContain('Use caching');
    });

    it('should summarize failed experiences', () => {
      const experiences = [
        {
          id: 'exp-2',
          taskId: 'task-2',
          agentId: 'agent-1',
          taskDescription: 'Fix bug',
          approachTaken: 'experimental',
          result: null,
          success: false,
          timeTakenMs: 5000,
          tokenCost: 100,
          department: 'eng',
          taskType: 'dev',
          lessons: ['Need more testing'],
          createdAt: new Date(),
        },
      ];

      const summary = summarizeExperiences(experiences);
      expect(summary).toContain('FAILURE');
      expect(summary).toContain('Fix bug');
    });

    it('should limit to 10 experiences', () => {
      const experiences = Array.from({ length: 15 }, (_, i) => ({
        id: `exp-${i}`,
        taskId: `task-${i}`,
        agentId: 'agent-1',
        taskDescription: `Task ${i}`,
        approachTaken: 'standard',
        result: null,
        success: true,
        timeTakenMs: 100,
        tokenCost: 10,
        department: 'eng',
        taskType: 'dev',
        lessons: [],
        createdAt: new Date(),
      }));

      const summary = summarizeExperiences(experiences);
      const lines = summary.split('\n');
      expect(lines).toHaveLength(10);
    });
  });
});
