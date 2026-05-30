export interface Routine {
  id: string;
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
}

export interface CreateRoutineInput {
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
  enabled?: boolean;
}

// Simple interval-based scheduling (no cron library)
// Parses simplified expressions: every N seconds/minutes/hours
// e.g. "every 30s", "every 5m", "every 1h"
function parseInterval(expr: string): number {
  const match = expr.match(/^every\s+(\d+)\s*(s|m|h)$/i);
  if (!match) throw new Error(`Invalid routine expression: "${expr}". Use format: "every Ns"|"every Nm"|"every Nh"`);
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return amount * 1000;
    case 'm': return amount * 60 * 1000;
    case 'h': return amount * 60 * 60 * 1000;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

let routines = new Map<string, Routine>();
let timers = new Map<string, ReturnType<typeof setInterval>>();
let idCounter = 0;

export function createRoutine(input: CreateRoutineInput): Routine {
  idCounter++;
  const id = `routine-${idCounter}`;
  const intervalMs = parseInterval(input.cronExpression);
  const nextRun = input.enabled !== false ? new Date(Date.now() + intervalMs) : null;

  const routine: Routine = {
    id,
    name: input.name,
    cronExpression: input.cronExpression,
    handler: input.handler,
    enabled: input.enabled !== false,
    lastRun: null,
    nextRun,
  };

  routines.set(id, routine);

  if (routine.enabled) {
    startTimer(routine, intervalMs);
  }

  return routine;
}

function startTimer(routine: Routine, intervalMs: number): void {
  const timer = setInterval(async () => {
    if (!routine.enabled) return;
    try {
      await routine.handler();
      routine.lastRun = new Date();
      routine.nextRun = new Date(Date.now() + intervalMs);
    } catch (err) {
      console.error(`[Routine] Error in "${routine.name}":`, err);
    }
  }, intervalMs);

  timers.set(routine.id, timer);
}

export function deleteRoutine(id: string): boolean {
  const timer = timers.get(id);
  if (timer) {
    clearInterval(timer);
    timers.delete(id);
  }
  return routines.delete(id);
}

export function getRoutines(): Routine[] {
  return Array.from(routines.values());
}

export function getRoutineById(id: string): Routine | undefined {
  return routines.get(id);
}

export function getNextRun(id: string): Date | null {
  const routine = routines.get(id);
  return routine?.nextRun ?? null;
}

export function resetRoutines(): void {
  for (const timer of timers.values()) {
    clearInterval(timer);
  }
  timers.clear();
  routines.clear();
  idCounter = 0;
}
