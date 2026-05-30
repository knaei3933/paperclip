import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWorkspace, getWorkspace, assignAgentToWorkspace } from '../src/workspaces/workspace.service.js';

function createMockDb() {
  const query = vi.fn(async () => ({ rows: [] }));
  return { pool: { query } };
}

describe('WorkspaceService', () => {
  let db: ReturnType<typeof createMockDb>;

  const mockWorkspaceRow = {
    id: 'ws-1',
    type: 'development',
    runtime: 'node',
    isolation_level: 'high',
    agent_id: 'agent-1',
  };

  beforeEach(() => {
    db = createMockDb();
  });

  describe('createWorkspace', () => {
    it('should create a workspace and return it', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockWorkspaceRow] }));

      const ws = await createWorkspace(db, {
        type: 'development',
        runtime: 'node',
        isolationLevel: 'high',
        agentId: 'agent-1',
      });

      expect(ws.id).toBe('ws-1');
      expect(ws.type).toBe('development');
      expect(ws.runtime).toBe('node');
      expect(ws.isolationLevel).toBe('high');
      expect(ws.agentId).toBe('agent-1');
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace when found', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [mockWorkspaceRow] }));

      const ws = await getWorkspace(db, 'ws-1');
      expect(ws).not.toBeNull();
      expect(ws!.id).toBe('ws-1');
    });

    it('should return null when workspace not found', async () => {
      db.pool.query = vi.fn(async () => ({ rows: [] }));

      const ws = await getWorkspace(db, 'nonexistent');
      expect(ws).toBeNull();
    });
  });

  describe('assignAgentToWorkspace', () => {
    it('should update agent workspace assignment', async () => {
      const queryFn = vi.fn(async () => ({ rows: [] }));
      db.pool.query = queryFn;

      await assignAgentToWorkspace(db, 'agent-1', 'ws-1');

      expect(queryFn).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id'),
        ['ws-1', 'agent-1'],
      );
    });
  });
});
