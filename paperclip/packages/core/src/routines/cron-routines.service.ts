import { CronExpressionParser } from 'cron-parser';
import type { Pool } from 'pg';

export interface CronRoutine {
  id: string;
  name: string;
  schedule: string;
  task_template: { title: string; description: string; priority?: number; budget?: number };
  department: string;
  enabled: boolean;
  last_run: Date | null;
  created_at: Date;
}

export class CronRoutineScheduler {
  private pool: Pool;
  private timer: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs = 60_000; // Check every minute

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async start(): Promise<void> {
    console.log('[CronRoutines] Starting scheduler...');
    this.timer = setInterval(() => {
      this.checkAndRun().catch((err) => {
        console.error('[CronRoutines] Error:', err);
      });
    }, this.checkIntervalMs);
    // Also run immediately on start
    await this.checkAndRun();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkAndRun(): Promise<void> {
    const result = await this.pool.query('SELECT * FROM routines WHERE enabled = true');
    const now = new Date();

    for (const row of result.rows) {
      try {
        const interval = CronExpressionParser.parse(row.schedule);
        const nextRun = interval.next().toDate();

        // Check if it's time to run (within the check interval)
        const diff = nextRun.getTime() - now.getTime();
        if (diff > 0 && diff < this.checkIntervalMs) {
          // Not yet time
          continue;
        }

        // Check if we already ran since the last scheduled time
        if (row.last_run) {
          const lastRun = new Date(row.last_run);
          const prevRun = interval.prev().toDate();
          if (lastRun >= prevRun) {
            continue; // Already ran for this period
          }
        }

        // Create task from template
        const template = row.task_template;
        await this.pool.query(
          `INSERT INTO tasks (id, title, description, status, priority, budget_allocated, budget_used, retry_count, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, 'queued', $3, $4, 0, 0, NOW(), NOW())`,
          [template.title, template.description, template.priority ?? 5, template.budget ?? 10]
        );

        // Update last_run
        await this.pool.query('UPDATE routines SET last_run = NOW() WHERE id = $1', [row.id]);
        console.log(`[CronRoutines] Created task from routine "${row.name}"`);
      } catch (err) {
        console.error(`[CronRoutines] Error processing routine "${row.name}":`, err);
      }
    }
  }

  async seedRoutine(input: { name: string; schedule: string; task_template: object; department: string }): Promise<void> {
    await this.pool.query(
      `INSERT INTO routines (name, schedule, task_template, department, enabled) VALUES ($1, $2, $3, $4, true)
       ON CONFLICT DO NOTHING`,
      [input.name, input.schedule, JSON.stringify(input.task_template), input.department]
    );
  }
}
