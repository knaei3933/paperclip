import type { Pool } from 'pg';

export interface DbPool {
  pool: Pool;
}

export interface ActivityLogEntry {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ActivityFilters {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

export async function logActivity(
  db: DbPool,
  input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<ActivityLogEntry> {
  const { pool } = db;
  // Using a simple activity_logs table structure
  // If the table doesn't exist, we use an inline approach
  const result = await pool.query(
    `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, actor_id, action, entity_type, entity_id, metadata, created_at`,
    [
      input.actorId,
      input.action,
      input.entityType,
      input.entityId,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
    createdAt: new Date(row.created_at),
  };
}

export async function getActivityLog(
  db: DbPool,
  filters: ActivityFilters = {},
): Promise<ActivityLogEntry[]> {
  const { pool } = db;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters.actorId) {
    conditions.push(`actor_id = $${paramIdx++}`);
    params.push(filters.actorId);
  }
  if (filters.action) {
    conditions.push(`action = $${paramIdx++}`);
    params.push(filters.action);
  }
  if (filters.entityType) {
    conditions.push(`entity_type = $${paramIdx++}`);
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    conditions.push(`entity_id = $${paramIdx++}`);
    params.push(filters.entityId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const result = await pool.query(
    `SELECT id, actor_id, action, entity_type, entity_id, metadata, created_at
     FROM activity_logs ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset],
  );

  return result.rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
    createdAt: new Date(row.created_at),
  }));
}

export async function getActivityForEntity(
  db: DbPool,
  entityType: string,
  entityId: string,
): Promise<ActivityLogEntry[]> {
  return getActivityLog(db, { entityType, entityId });
}
