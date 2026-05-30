import type { BaseAgentAdapter } from '@paperclip/agent-adapters';

const adapters = new Map<string, BaseAgentAdapter>();

export function registerAdapter(adapter: BaseAgentAdapter): void {
  if (adapters.has(adapter.adapterType)) {
    throw new Error(`Adapter already registered: ${adapter.adapterType}`);
  }
  adapters.set(adapter.adapterType, adapter);
}

export function getAdapter(type: string): BaseAgentAdapter | undefined {
  return adapters.get(type);
}

export function listAdapters(): Array<{ type: string; capabilities: string[] }> {
  return Array.from(adapters.values()).map((a) => ({
    type: a.adapterType,
    capabilities: a.getCapabilities(),
  }));
}

export function clearAdapters(): void {
  adapters.clear();
}
