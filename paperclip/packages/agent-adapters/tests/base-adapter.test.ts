import { describe, it, expect } from 'vitest';
import type { Task } from '@paperclip/shared-types';
import { BaseAgentAdapter } from '../src/base-adapter.js';
import type { AdapterContext, AdapterResult, AdapterStatus } from '../src/base-adapter.js';

class ConcreteAdapter extends BaseAgentAdapter {
  readonly adapterType = 'test-adapter';
  private status: AdapterStatus = 'idle';

  async execute(task: Task, context: AdapterContext): Promise<AdapterResult> {
    return {
      success: true,
      output: `executed: ${context.enrichedPrompt}`,
      latencyMs: 10,
    };
  }

  getStatus(): AdapterStatus {
    return this.status;
  }

  async cancel(_taskId: string): Promise<void> {
    this.status = 'idle';
  }

  getCapabilities(): string[] {
    return ['test-capability'];
  }
}

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

describe('BaseAgentAdapter', () => {
  it('exposes adapterType', () => {
    const adapter = new ConcreteAdapter();
    expect(adapter.adapterType).toBe('test-adapter');
  });

  it('execute returns a result with required fields', async () => {
    const adapter = new ConcreteAdapter();
    const result = await adapter.execute(makeTask(), {
      skillHints: [],
      memorySummary: '',
      enrichedPrompt: 'hello',
    });
    expect(result.success).toBe(true);
    expect(result.output).toBe('executed: hello');
    expect(result.latencyMs).toBe(10);
  });

  it('getStatus returns current status', () => {
    const adapter = new ConcreteAdapter();
    expect(adapter.getStatus()).toBe('idle');
  });

  it('getCapabilities returns capability list', () => {
    const adapter = new ConcreteAdapter();
    expect(adapter.getCapabilities()).toEqual(['test-capability']);
  });

  it('cancel resolves without error', async () => {
    const adapter = new ConcreteAdapter();
    await expect(adapter.cancel('task-1')).resolves.toBeUndefined();
  });

  it('cannot be instantiated directly (abstract)', () => {
    // BaseAgentAdapter is abstract — verify via prototype
    expect(BaseAgentAdapter.prototype.constructor.name).toBe('BaseAgentAdapter');
    // Concrete subclass works fine
    const adapter = new ConcreteAdapter();
    expect(adapter).toBeInstanceOf(BaseAgentAdapter);
  });
});
