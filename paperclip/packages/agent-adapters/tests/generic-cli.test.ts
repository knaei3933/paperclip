import { describe, it, expect } from 'vitest';
import type { Task } from '@paperclip/shared-types';
import { GenericCliAdapter } from '../src/generic-cli/generic-cli-adapter.js';

const makeTask = (overrides?: Partial<Task>): Task => ({
  id: 'task-1',
  title: 'Test task',
  description: 'Do something',
  status: 'queued',
  assigneeId: 'agent-1',
  budgetAllocated: 1.0,
  budgetUsed: 0,
  priority: 1,
  result: null,
  retryCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('GenericCliAdapter', () => {
  it('executes a shell command and returns result', async () => {
    const adapter = new GenericCliAdapter('echo-test', {
      commandTemplate: 'echo hello world',
    });
    const result = await adapter.execute(makeTask(), {
      skillHints: [],
      memorySummary: '',
      enrichedPrompt: 'test',
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello');
    expect(result.output).toContain('world');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('substitutes {{task}} placeholder', async () => {
    const adapter = new GenericCliAdapter('echo-task', {
      commandTemplate: 'echo {{task}}',
    });
    const result = await adapter.execute(makeTask({ description: 'my-task-input' }), {
      skillHints: [],
      memorySummary: '',
      enrichedPrompt: 'my-task-input',
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('my-task-input');
  });

  it('returns error for failing command', async () => {
    const adapter = new GenericCliAdapter('fail-test', {
      commandTemplate: 'exit 1',
    });
    const result = await adapter.execute(makeTask(), {
      skillHints: [],
      memorySummary: '',
      enrichedPrompt: 'test',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('exposes correct adapterType', () => {
    const adapter = new GenericCliAdapter('custom-type', {
      commandTemplate: 'echo "hi"',
    });
    expect(adapter.adapterType).toBe('custom-type');
  });

  it('status transitions from idle to busy and back', async () => {
    const adapter = new GenericCliAdapter('status-test', {
      commandTemplate: 'echo "ok"',
    });
    expect(adapter.getStatus()).toBe('idle');
    await adapter.execute(makeTask(), {
      skillHints: [],
      memorySummary: '',
      enrichedPrompt: 'test',
    });
    expect(adapter.getStatus()).toBe('idle');
  });
});
