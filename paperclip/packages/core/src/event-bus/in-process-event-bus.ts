import type { AppDomainEvent, EventBus } from '@paperclip/shared-types';

type EventHandler = (event: AppDomainEvent) => void;

export class InProcessEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  emit(event: AppDomainEvent): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error(
          `[EventBus] Error in handler for "${event.type}":`,
          err,
        );
      }
    }
  }

  on<T extends AppDomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void,
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
  }

  off<T extends AppDomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void,
  ): void {
    this.handlers.get(eventType)?.delete(handler as EventHandler);
  }
}

let instance: InProcessEventBus | null = null;

export function createEventBus(): EventBus {
  if (!instance) {
    instance = new InProcessEventBus();
  }
  return instance;
}

export function resetEventBus(): void {
  instance = null;
}
