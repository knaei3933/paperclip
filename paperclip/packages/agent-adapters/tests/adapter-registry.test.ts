import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerAdapter,
  getAdapter,
  listAdapters,
  clearAdapters,
} from '../../core/src/plugins/adapter-registry.js';
import { BaseAgentAdapter } from '../src/base-adapter.js';
import type { AdapterContext, AdapterResult, AdapterStatus } from '../src/base-adapter.js';
import type { Task } from '@paperclip/shared-types';

class MockAdapter extends BaseAgentAdapter {
  readonly adapterType: string;
  private caps: string[];

  constructor(type: string, caps: string[] = ['mock']) {
    super();
    this.adapterType = type;
    this.caps = caps;
  }

  async execute(_task: Task, _context: AdapterContext): Promise<AdapterResult> {
    return { success: true, output: 'mock', latencyMs: 0 };
  }

  getStatus(): AdapterStatus {
    return 'idle';
  }

  async cancel(_taskId: string): Promise<void> {}

  getCapabilities(): string[] {
    return this.caps;
  }
}

describe('Adapter Registry', () => {
  beforeEach(() => {
    clearAdapters();
  });

  it('registers an adapter', () => {
    const adapter = new MockAdapter('test-type');
    registerAdapter(adapter);
    const found = getAdapter('test-type');
    expect(found).toBe(adapter);
  });

  it('throws on duplicate registration', () => {
    registerAdapter(new MockAdapter('dup-type'));
    expect(() => registerAdapter(new MockAdapter('dup-type'))).toThrow(
      'Adapter already registered: dup-type',
    );
  });

  it('returns undefined for unregistered type', () => {
    expect(getAdapter('nonexistent')).toBeUndefined();
  });

  it('lists all registered adapters', () => {
    registerAdapter(new MockAdapter('type-a', ['cap-a']));
    registerAdapter(new MockAdapter('type-b', ['cap-b', 'cap-c']));

    const list = listAdapters();
    expect(list).toHaveLength(2);
    expect(list.map((a) => a.type).sort()).toEqual(['type-a', 'type-b']);
    const typeB = list.find((a) => a.type === 'type-b');
    expect(typeB?.capabilities).toEqual(['cap-b', 'cap-c']);
  });

  it('clearAdapters removes all adapters', () => {
    registerAdapter(new MockAdapter('temp'));
    expect(getAdapter('temp')).toBeDefined();
    clearAdapters();
    expect(getAdapter('temp')).toBeUndefined();
    expect(listAdapters()).toHaveLength(0);
  });

  it('lists empty when no adapters registered', () => {
    expect(listAdapters()).toEqual([]);
  });
});
