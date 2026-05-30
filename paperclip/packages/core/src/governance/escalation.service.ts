import type {
  EscalationRequest,
  EscalationUrgency,
  EventBus,
} from '@paperclip/shared-types';
import type { Pool } from 'pg';

export interface CreateEscalationInput {
  taskId: string;
  reason: string;
  urgency: EscalationUrgency;
  channel?: string;
}

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

let pool: Pool | null = null;
let eventBus: EventBus | null = null;

export function setEventBus(bus: EventBus): void {
  eventBus = bus;
}

export function setPool(dbPool: Pool): void {
  pool = dbPool;
}

export async function createEscalation(input: CreateEscalationInput): Promise<EscalationRequest> {
  if (!pool) throw new Error('Escalation pool not initialized');
  const result = await pool.query(
    `INSERT INTO escalation_requests (task_id, reason, urgency, channel, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [input.taskId, input.reason, input.urgency, input.channel ?? '']
  );
  const esc = mapRow(result.rows[0]);

  if (eventBus) {
    eventBus.emit({
      type: 'EscalationCreated',
      payload: { escalationId: esc.id, taskId: esc.taskId },
      timestamp: new Date(),
      correlationId: esc.id,
    });
  }

  return esc;
}

export async function approveEscalation(escalationId: string): Promise<EscalationRequest> {
  if (!pool) throw new Error('Escalation pool not initialized');
  const result = await pool.query(
    "UPDATE escalation_requests SET status = 'approved', resolved_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *",
    [escalationId]
  );
  if (result.rows.length === 0) throw new Error(`Escalation not found or already resolved: ${escalationId}`);
  return mapRow(result.rows[0]);
}

export async function rejectEscalation(escalationId: string): Promise<EscalationRequest> {
  if (!pool) throw new Error('Escalation pool not initialized');
  const result = await pool.query(
    "UPDATE escalation_requests SET status = 'rejected', resolved_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *",
    [escalationId]
  );
  if (result.rows.length === 0) throw new Error(`Escalation not found or already resolved: ${escalationId}`);
  return mapRow(result.rows[0]);
}

export async function checkExpiredEscalations(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<EscalationRequest[]> {
  if (!pool) return [];
  const cutoff = new Date(Date.now() - timeoutMs).toISOString();
  const result = await pool.query(
    "UPDATE escalation_requests SET status = 'expired', resolved_at = NOW() WHERE status = 'pending' AND created_at < $1 RETURNING *",
    [cutoff]
  );
  return result.rows.map(mapRow);
}

export async function getPendingEscalations(): Promise<EscalationRequest[]> {
  if (!pool) return [];
  const result = await pool.query("SELECT * FROM escalation_requests WHERE status = 'pending' ORDER BY created_at ASC");
  return result.rows.map(mapRow);
}

export async function getEscalationById(id: string): Promise<EscalationRequest | null> {
  if (!pool) return null;
  const result = await pool.query('SELECT * FROM escalation_requests WHERE id = $1', [id]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getAllEscalations(): Promise<EscalationRequest[]> {
  if (!pool) return [];
  const result = await pool.query('SELECT * FROM escalation_requests ORDER BY created_at DESC');
  return result.rows.map(mapRow);
}

export function resetEscalations(): void {
  // DB-backed, no-op for in-memory reset
}

function mapRow(row: any): EscalationRequest {
  return {
    id: row.id,
    taskId: row.task_id,
    reason: row.reason,
    urgency: row.urgency,
    channel: row.channel,
    status: row.status,
    createdAt: new Date(row.created_at),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
  };
}
