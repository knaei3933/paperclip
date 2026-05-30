import { vi } from 'vitest';
import type { EventBus, AppDomainEvent } from '@paperclip/shared-types';

/**
 * Creates a mock DbPool with a mock pool.query method.
 */
export function createMockDb(queryMock?: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) {
  const query = queryMock ?? vi.fn(async () => ({ rows: [] }));
  return {
    pool: { query },
  };
}

/**
 * Creates a mock EventBus that records emitted events.
 */
export function createMockEventBus(): EventBus & { events: AppDomainEvent[] } {
  const events: AppDomainEvent[] = [];
  const handlers = new Map<string, Set<(event: AppDomainEvent) => void>>();

  return {
    events,
    emit(event: AppDomainEvent): void {
      events.push(event);
      const set = handlers.get(event.type);
      if (set) {
        for (const h of set) {
          try { h(event); } catch { /* ignore */ }
        }
      }
    },
    on<T extends AppDomainEvent>(
      eventType: T['type'],
      handler: (event: T) => void,
    ): void {
      if (!handlers.has(eventType)) handlers.set(eventType, new Set());
      handlers.get(eventType)!.add(handler as (event: AppDomainEvent) => void);
    },
    off<T extends AppDomainEvent>(
      eventType: T['type'],
      handler: (event: T) => void,
    ): void {
      handlers.get(eventType)?.delete(handler as (event: AppDomainEvent) => void);
    },
  };
}
