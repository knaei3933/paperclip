import type { TaskStatus } from '@paperclip/shared-types';

/**
 * Valid state transitions for task lifecycle.
 * queued -> assigned -> running -> completed | failed | timed_out
 * Any terminal state cannot transition further.
 */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ['assigned'],
  assigned: ['running', 'failed', 'queued'],
  running: ['completed', 'failed', 'timed_out'],
  completed: [],
  failed: [],
  timed_out: [],
};

export function isValidTransition(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidTransitions(status: TaskStatus): TaskStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: TaskStatus,
    public readonly to: TaskStatus,
  ) {
    super(`Invalid task status transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function validateTransition(
  from: TaskStatus,
  to: TaskStatus,
): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
