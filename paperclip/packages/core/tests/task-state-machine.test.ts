import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  getValidTransitions,
  isTerminalStatus,
  validateTransition,
  InvalidTransitionError,
} from '../src/tasks/task-state-machine.js';

describe('TaskStateMachine', () => {
  describe('valid transitions', () => {
    it('queued -> assigned is valid', () => {
      expect(isValidTransition('queued', 'assigned')).toBe(true);
    });

    it('assigned -> running is valid', () => {
      expect(isValidTransition('assigned', 'running')).toBe(true);
    });

    it('assigned -> failed is valid', () => {
      expect(isValidTransition('assigned', 'failed')).toBe(true);
    });

    it('assigned -> queued is valid (re-queue)', () => {
      expect(isValidTransition('assigned', 'queued')).toBe(true);
    });

    it('running -> completed is valid', () => {
      expect(isValidTransition('running', 'completed')).toBe(true);
    });

    it('running -> failed is valid', () => {
      expect(isValidTransition('running', 'failed')).toBe(true);
    });

    it('running -> timed_out is valid', () => {
      expect(isValidTransition('running', 'timed_out')).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('queued -> running is invalid (must go through assigned)', () => {
      expect(isValidTransition('queued', 'running')).toBe(false);
    });

    it('queued -> completed is invalid', () => {
      expect(isValidTransition('queued', 'completed')).toBe(false);
    });

    it('completed -> running is invalid', () => {
      expect(isValidTransition('completed', 'running')).toBe(false);
    });

    it('completed -> queued is invalid', () => {
      expect(isValidTransition('completed', 'queued')).toBe(false);
    });

    it('failed -> running is invalid', () => {
      expect(isValidTransition('failed', 'running')).toBe(false);
    });

    it('failed -> queued is invalid', () => {
      expect(isValidTransition('failed', 'queued')).toBe(false);
    });

    it('timed_out -> running is invalid', () => {
      expect(isValidTransition('timed_out', 'running')).toBe(false);
    });

    it('timed_out -> queued is invalid', () => {
      expect(isValidTransition('timed_out', 'queued')).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('queued has one valid transition: assigned', () => {
      expect(getValidTransitions('queued')).toEqual(['assigned']);
    });

    it('assigned has three valid transitions', () => {
      expect(getValidTransitions('assigned')).toEqual(['running', 'failed', 'queued']);
    });

    it('running has three valid transitions', () => {
      expect(getValidTransitions('running')).toEqual(['completed', 'failed', 'timed_out']);
    });

    it('terminal states have no transitions', () => {
      expect(getValidTransitions('completed')).toEqual([]);
      expect(getValidTransitions('failed')).toEqual([]);
      expect(getValidTransitions('timed_out')).toEqual([]);
    });
  });

  describe('isTerminalStatus', () => {
    it('completed is terminal', () => {
      expect(isTerminalStatus('completed')).toBe(true);
    });

    it('failed is terminal', () => {
      expect(isTerminalStatus('failed')).toBe(true);
    });

    it('timed_out is terminal', () => {
      expect(isTerminalStatus('timed_out')).toBe(true);
    });

    it('queued is not terminal', () => {
      expect(isTerminalStatus('queued')).toBe(false);
    });

    it('assigned is not terminal', () => {
      expect(isTerminalStatus('assigned')).toBe(false);
    });

    it('running is not terminal', () => {
      expect(isTerminalStatus('running')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() => validateTransition('queued', 'assigned')).not.toThrow();
    });

    it('throws InvalidTransitionError for invalid transition', () => {
      expect(() => validateTransition('completed', 'running')).toThrow(
        InvalidTransitionError,
      );
    });

    it('InvalidTransitionError has correct properties', () => {
      try {
        validateTransition('completed', 'running');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidTransitionError);
        const e = err as InvalidTransitionError;
        expect(e.from).toBe('completed');
        expect(e.to).toBe('running');
        expect(e.message).toContain('completed');
        expect(e.message).toContain('running');
      }
    });

    it('same-status transition is invalid for terminal states', () => {
      expect(isValidTransition('completed', 'completed')).toBe(false);
      expect(isValidTransition('failed', 'failed')).toBe(false);
    });

    it('queued -> queued is invalid', () => {
      expect(isValidTransition('queued', 'queued')).toBe(false);
    });
  });
});
