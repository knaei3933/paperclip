import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoutine, deleteRoutine, getRoutines, getRoutineById, getNextRun, resetRoutines } from '../src/routines/routines.service.js';

describe('RoutinesService', () => {
  beforeEach(() => {
    resetRoutines();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetRoutines();
    vi.useRealTimers();
  });

  it('should create a routine with correct properties', () => {
    const routine = createRoutine({
      name: 'test-routine',
      cronExpression: 'every 30s',
      handler: async () => {},
    });

    expect(routine.name).toBe('test-routine');
    expect(routine.cronExpression).toBe('every 30s');
    expect(routine.enabled).toBe(true);
    expect(routine.lastRun).toBeNull();
    expect(routine.nextRun).not.toBeNull();
  });

  it('should create a disabled routine', () => {
    const routine = createRoutine({
      name: 'disabled-routine',
      cronExpression: 'every 1h',
      handler: async () => {},
      enabled: false,
    });

    expect(routine.enabled).toBe(false);
    expect(routine.nextRun).toBeNull();
  });

  it('should throw on invalid cron expression', () => {
    expect(() =>
      createRoutine({
        name: 'bad',
        cronExpression: 'invalid',
        handler: async () => {},
      }),
    ).toThrow('Invalid routine expression');
  });

  it('should parse seconds interval', () => {
    const routine = createRoutine({
      name: 'seconds',
      cronExpression: 'every 10s',
      handler: async () => {},
    });

    expect(routine.nextRun).not.toBeNull();
    const diff = routine.nextRun!.getTime() - Date.now();
    expect(diff).toBe(10000);
  });

  it('should parse minutes interval', () => {
    const routine = createRoutine({
      name: 'minutes',
      cronExpression: 'every 5m',
      handler: async () => {},
    });

    const diff = routine.nextRun!.getTime() - Date.now();
    expect(diff).toBe(5 * 60 * 1000);
  });

  it('should parse hours interval', () => {
    const routine = createRoutine({
      name: 'hours',
      cronExpression: 'every 1h',
      handler: async () => {},
    });

    const diff = routine.nextRun!.getTime() - Date.now();
    expect(diff).toBe(60 * 60 * 1000);
  });

  it('should execute handler on interval', () => {
    const handler = vi.fn(async () => {});
    createRoutine({
      name: 'test',
      cronExpression: 'every 1s',
      handler,
    });

    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not execute handler for disabled routine', () => {
    const handler = vi.fn(async () => {});
    createRoutine({
      name: 'disabled',
      cronExpression: 'every 1s',
      handler,
      enabled: false,
    });

    vi.advanceTimersByTime(5000);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle errors in handler gracefully', () => {
    const handler = vi.fn(async () => { throw new Error('handler error'); });
    createRoutine({
      name: 'failing',
      cronExpression: 'every 1s',
      handler,
    });

    vi.advanceTimersByTime(1500);

    // Handler was called despite error
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should delete a routine', () => {
    const routine = createRoutine({
      name: 'to-delete',
      cronExpression: 'every 30s',
      handler: async () => {},
    });

    const result = deleteRoutine(routine.id);
    expect(result).toBe(true);
    expect(getRoutineById(routine.id)).toBeUndefined();
  });

  it('should return false when deleting non-existent routine', () => {
    const result = deleteRoutine('nonexistent');
    expect(result).toBe(false);
  });

  it('should get all routines', () => {
    createRoutine({ name: 'r1', cronExpression: 'every 10s', handler: async () => {} });
    createRoutine({ name: 'r2', cronExpression: 'every 20s', handler: async () => {} });

    const routines = getRoutines();
    expect(routines).toHaveLength(2);
  });

  it('should get routine by id', () => {
    const routine = createRoutine({
      name: 'find-me',
      cronExpression: 'every 30s',
      handler: async () => {},
    });

    const found = getRoutineById(routine.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('find-me');
  });

  it('should get next run time', () => {
    const routine = createRoutine({
      name: 'scheduled',
      cronExpression: 'every 1m',
      handler: async () => {},
    });

    const nextRun = getNextRun(routine.id);
    expect(nextRun).not.toBeNull();
  });

  it('should return null for next run of non-existent routine', () => {
    expect(getNextRun('nonexistent')).toBeNull();
  });
});
