import { describe, it, expect, beforeEach } from 'vitest';
import { InProcessEventBus, createEventBus, resetEventBus } from '../src/event-bus/in-process-event-bus.js';
import type { AppDomainEvent, EventBus } from '@paperclip/shared-types';

describe('InProcessEventBus', () => {
  let bus: InProcessEventBus;

  beforeEach(() => {
    resetEventBus();
    bus = new InProcessEventBus();
  });

  it('calls registered handler on emit', () => {
    const handler = vi.fn();
    bus.on('TaskCompleted', handler);

    const event: AppDomainEvent = {
      type: 'TaskCompleted',
      payload: { taskId: '1', agentId: 'a1', result: null },
      timestamp: new Date(),
      correlationId: 'c1',
    };
    bus.emit(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not call handler after off', () => {
    const handler = vi.fn();
    bus.on('TaskCompleted', handler);
    bus.off('TaskCompleted', handler);

    bus.emit({
      type: 'TaskCompleted',
      payload: { taskId: '1', agentId: 'a1', result: null },
      timestamp: new Date(),
      correlationId: 'c1',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls multiple handlers for the same event type', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('TaskCompleted', handler1);
    bus.on('TaskCompleted', handler2);

    const event: AppDomainEvent = {
      type: 'TaskCompleted',
      payload: { taskId: '1', agentId: 'a1', result: null },
      timestamp: new Date(),
      correlationId: 'c1',
    };
    bus.emit(event);
    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it('continues calling handlers when one throws', () => {
    const errorHandler = vi.fn(() => {
      throw new Error('boom');
    });
    const goodHandler = vi.fn();
    bus.on('TaskFailed', errorHandler);
    bus.on('TaskFailed', goodHandler);

    const event: AppDomainEvent = {
      type: 'TaskFailed',
      payload: { taskId: '1', agentId: 'a1', error: 'err' },
      timestamp: new Date(),
      correlationId: 'c1',
    };
    bus.emit(event);
    expect(errorHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled();
  });

  it('does nothing when emitting with no registered handlers', () => {
    expect(() =>
      bus.emit({
        type: 'TaskCompleted',
        payload: { taskId: '1', agentId: 'a1', result: null },
        timestamp: new Date(),
        correlationId: 'c1',
      }),
    ).not.toThrow();
  });

  it('only calls handlers for the matching event type', () => {
    const completedHandler = vi.fn();
    const failedHandler = vi.fn();
    bus.on('TaskCompleted', completedHandler);
    bus.on('TaskFailed', failedHandler);

    bus.emit({
      type: 'TaskCompleted',
      payload: { taskId: '1', agentId: 'a1', result: null },
      timestamp: new Date(),
      correlationId: 'c1',
    });
    expect(completedHandler).toHaveBeenCalled();
    expect(failedHandler).not.toHaveBeenCalled();
  });

  describe('createEventBus', () => {
    it('should return a singleton EventBus instance', () => {
      const bus1 = createEventBus();
      const bus2 = createEventBus();
      expect(bus1).toBe(bus2);
    });

    it('should return a new instance after resetEventBus', () => {
      const bus1 = createEventBus();
      resetEventBus();
      const bus2 = createEventBus();
      expect(bus1).not.toBe(bus2);
    });

    it('should return an InProcessEventBus', () => {
      const bus = createEventBus();
      expect(bus).toBeInstanceOf(InProcessEventBus);
    });
  });
});
