import type { Task, TaskStatus } from '@paperclip/shared-types';
import type { Pool } from 'pg';
import type { EventBus } from '@paperclip/shared-types';
import type { BaseAgentAdapter, AdapterContext } from '@paperclip/agent-adapters';
import { getAdapter } from '../plugins/adapter-registry.js';
import { checkBudget, trackSpend, convertTokensToCost } from '../budget/budget.service.js';
import type { CostModel } from '../budget/cost-model.js';

export interface DbPool {
  pool: Pool;
}

export interface HeartbeatConfig {
  pollIntervalMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  watchdogIntervalMs?: number;
  defaultAdapterType?: string;
  costModel?: CostModel;
}

const DEFAULT_CONFIG: Required<HeartbeatConfig> = {
  pollIntervalMs: 5_000,
  timeoutMs: 30 * 60 * 1_000, // 30 minutes
  maxRetries: 3,
  watchdogIntervalMs: 60_1_000, // 60 seconds
  defaultAdapterType: 'claude-code',
  costModel: { promptCostPer1K: 0.003, completionCostPer1K: 0.015 },
};

export class HeartbeatEngine {
  private config: Required<HeartbeatConfig>;
  private db: DbPool;
  private eventBus: EventBus;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private notifyListener: ((payload: string) => void) | null = null;
  private running = false;

  constructor(db: DbPool, eventBus: EventBus, config?: HeartbeatConfig) {
    this.db = db;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // PostgreSQL NOTIFY/LISTEN for low-latency hint
    const { pool } = this.db;
    this.notifyListener = (payload: string) => {
      // NOTIFY is a hint — just trigger immediate poll
      this.processNextTask().catch((err) => {
        console.error('[Heartbeat] Error on NOTIFY-driven process:', err);
      });
    };

    try {
      const client = await pool.connect();
      await client.query('LISTEN new_task');
      client.on('notification', (msg) => {
        if (msg.channel === 'new_task' && this.notifyListener) {
          this.notifyListener(msg.payload ?? '');
        }
      });
      // Keep the client alive for LISTEN; release would drop it
      // Store for cleanup later (not releasing here)
      this._listenClient = client;
    } catch {
      // LISTEN is best-effort; polling fallback covers it
      console.warn('[Heartbeat] LISTEN setup failed, relying on polling only');
    }

    // Polling fallback
    this.pollTimer = setInterval(() => {
      this.processNextTask().catch((err) => {
        console.error('[Heartbeat] Error on poll:', err);
      });
    }, this.config.pollIntervalMs);

    // Timeout watchdog
    this.watchdogTimer = setInterval(() => {
      this.checkStuckTasks().catch((err) => {
        console.error('[Heartbeat] Error on watchdog:', err);
      });
    }, this.config.watchdogIntervalMs);
  }

  private _listenClient: import('pg').PoolClient | null = null;

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this._listenClient) {
      try {
        await this._listenClient.query('UNLISTEN new_task');
        this._listenClient.release();
      } catch {
        // best-effort cleanup
      }
      this._listenClient = null;
    }
    this.notifyListener = null;
  }

  async processNextTask(): Promise<Task | null> {
    const { pool } = this.db;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Atomic task checkout with FOR UPDATE SKIP LOCKED
      const result = await client.query(
        `SELECT * FROM tasks
         WHERE status = 'queued'
         ORDER BY priority DESC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
      );

      if (result.rows.length === 0) {
        await client.query('COMMIT');
        return null;
      }

      const task = result.rows[0];
      await client.query(
        `UPDATE tasks SET status = 'running', updated_at = now() WHERE id = $1`,
        [task.id],
      );

      await client.query('COMMIT');

      const mappedTask: Task = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: 'running' as TaskStatus,
        assigneeId: task.assignee_id ?? '',
        budgetAllocated: Number(task.budget_allocated),
        budgetUsed: Number(task.budget_used),
        priority: task.priority,
        result: task.result,
        retryCount: task.retry_count,
        createdAt: new Date(task.created_at),
        updatedAt: new Date(),
      };

      // Resolve adapter and execute
      await this.executeWithAdapter(mappedTask);

      return mappedTask;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async executeWithAdapter(task: Task): Promise<void> {
    const adapterType = this.config.defaultAdapterType;
    const adapter = getAdapter(adapterType);

    if (!adapter) {
      this.eventBus.emit({
        type: 'TaskFailed',
        payload: { taskId: task.id, agentId: task.assigneeId, error: `No adapter registered for type: ${adapterType}` },
        timestamp: new Date(),
        correlationId: task.id,
      });
      return;
    }

    // Budget check before execution
    const budget = checkBudget(task.assigneeId, task.id);
    if (!budget.allowed) {
      this.eventBus.emit({
        type: 'TaskFailed',
        payload: { taskId: task.id, agentId: task.assigneeId, error: 'Budget exhausted' },
        timestamp: new Date(),
        correlationId: task.id,
      });
      this.eventBus.emit({
        type: 'EscalationCreated',
        payload: { escalationId: '', taskId: task.id },
        timestamp: new Date(),
        correlationId: task.id,
      });
      return;
    }

    // SkillApplicator placeholder — will be wired in Step 4
    const context: AdapterContext = {
      skillHints: [],
      memorySummary: '',
      enrichedPrompt: task.description,
    };

    const result = await adapter.execute(task, context);

    // Track cost from token usage
    if (result.tokenUsage) {
      const cost = convertTokensToCost(result.tokenUsage, this.config.costModel);
      trackSpend(task.assigneeId, task.id, cost);
    }

    // Update task status based on result
    const { pool } = this.db;
    if (result.success) {
      const resultJson = typeof result.output === 'string'
        ? JSON.stringify({ output: result.output })
        : result.output;
      await pool.query(
        `UPDATE tasks SET status = 'completed', result = $1, updated_at = now() WHERE id = $2`,
        [resultJson, task.id],
      );
      this.eventBus.emit({
        type: 'TaskCompleted',
        payload: { taskId: task.id, agentId: task.assigneeId, result: result.output },
        timestamp: new Date(),
        correlationId: task.id,
      });

      // Pipeline advancement: direct check (not EventBus-dependent for reliability)
      const pipelineRow = await pool.query('SELECT pipeline_id FROM tasks WHERE id = $1', [task.id]);
      const pipelineId = pipelineRow.rows[0]?.pipeline_id;
      if (pipelineId) {
        try {
          const { advancePipeline } = await import('../pipelines/pipeline.service.js');
          const advanceResult = await advancePipeline(pool, pipelineId, task.id);
          if (advanceResult.advanced) {
            this.eventBus.emit({
              type: 'PipelineAdvanced',
              payload: { pipelineId, completedTaskId: task.id, nextTaskId: advanceResult.nextTaskId },
              timestamp: new Date(),
              correlationId: pipelineId,
            });
          }
        } catch (err) {
          console.error(`[Heartbeat] Pipeline advancement failed for ${pipelineId}:`, err);
          try {
            const { failPipeline } = await import('../pipelines/pipeline.service.js');
            await failPipeline(pool, pipelineId);
          } catch { /* best effort */ }
        }
      }
    } else {
      await pool.query(
        `UPDATE tasks SET status = 'failed', result = $1, updated_at = now() WHERE id = $2`,
        [JSON.stringify({ error: result.error ?? 'Unknown error' }), task.id],
      );
      this.eventBus.emit({
        type: 'TaskFailed',
        payload: { taskId: task.id, agentId: task.assigneeId, error: result.error ?? 'Unknown error' },
        timestamp: new Date(),
        correlationId: task.id,
      });
    }
  }

  async checkStuckTasks(): Promise<Task[]> {
    const { pool } = this.db;
    const cutoff = new Date(Date.now() - this.config.timeoutMs);

    // Find running tasks older than the timeout
    const stuck = await pool.query(
      `SELECT * FROM tasks
       WHERE status = 'running' AND updated_at < $1`,
      [cutoff.toISOString()],
    );

    const timedOut: Task[] = [];

    for (const row of stuck.rows) {
      const retryCount = row.retry_count as number;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (retryCount >= this.config.maxRetries) {
          // Permanent failure
          await client.query(
            `UPDATE tasks SET status = 'failed', updated_at = now() WHERE id = $1`,
            [row.id],
          );
        } else {
          // Re-queue with incremented retry count
          await client.query(
            `UPDATE tasks SET status = 'queued', retry_count = $1,
             assignee_id = NULL, updated_at = now()
             WHERE id = $2`,
            [retryCount + 1, row.id],
          );
        }

        await client.query('COMMIT');

        const task: Task = {
          id: row.id,
          title: row.title,
          description: row.description,
          status: 'timed_out' as TaskStatus,
          assigneeId: row.assignee_id ?? '',
          budgetAllocated: Number(row.budget_allocated),
          budgetUsed: Number(row.budget_used),
          priority: row.priority,
          result: row.result,
          retryCount: row.retry_count,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(),
        };
        timedOut.push(task);

        this.eventBus.emit({
          type: 'TaskTimedOut',
          payload: {
            taskId: row.id,
            agentId: row.assignee_id ?? '',
          },
          timestamp: new Date(),
          correlationId: row.id,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Heartbeat] Error processing stuck task ${row.id}:`, err);
      } finally {
        client.release();
      }
    }

    return timedOut;
  }
}
