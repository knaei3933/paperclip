import type { DbPool } from '../db/pool.js';

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'contract' | 'delivery' | 'installation' | 'complete' | 'as';

export interface Deal {
  id: string;
  title: string;
  customerId: string;
  manufacturerId: string | null;
  stage: DealStage;
  amount: number | null;
  probability: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const STAGE_ORDER: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'contract', 'delivery', 'installation', 'complete', 'as'];
const STAGE_PROBABILITY: Record<DealStage, number> = {
  lead: 10, qualified: 25, proposal: 40, negotiation: 60,
  contract: 80, delivery: 90, installation: 95, complete: 100, as: 100,
};

const DEAL_COLUMNS = `id, title, customer_id as "customerId", manufacturer_id as "manufacturerId", stage, amount, probability, notes, created_at as "createdAt", updated_at as "updatedAt"`;

export async function listDeals(db: DbPool, filters?: { stage?: DealStage; customerId?: string }): Promise<Deal[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.stage) {
    conditions.push(`stage = $${idx}`);
    params.push(filters.stage);
    idx++;
  }
  if (filters?.customerId) {
    conditions.push(`customer_id = $${idx}`);
    params.push(filters.customerId);
    idx++;
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.pool.query(
    `SELECT ${DEAL_COLUMNS} FROM deals ${where} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

export async function getDealById(db: DbPool, id: string): Promise<Deal | null> {
  const { rows } = await db.pool.query(
    `SELECT ${DEAL_COLUMNS} FROM deals WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createDeal(db: DbPool, data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'probability'> & { probability?: number }): Promise<Deal> {
  const stage = (data.stage ?? 'lead') as DealStage;
  const probability = data.probability ?? STAGE_PROBABILITY[stage];
  const { rows } = await db.pool.query(
    `INSERT INTO deals (title, customer_id, manufacturer_id, stage, amount, probability, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${DEAL_COLUMNS}`,
    [data.title, data.customerId, data.manufacturerId, stage, data.amount, probability, data.notes]
  );
  return rows[0];
}

export async function updateDeal(db: DbPool, id: string, data: Partial<Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Deal | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const col = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
      fields.push(`${col} = $${idx}`);
      values.push(value);
      idx++;
    }
  }
  if (fields.length === 0) return getDealById(db, id);
  values.push(id);
  const { rows } = await db.pool.query(
    `UPDATE deals SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx}
     RETURNING ${DEAL_COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

export async function deleteDeal(db: DbPool, id: string): Promise<boolean> {
  const { rowCount } = await db.pool.query('DELETE FROM deals WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function advanceDeal(db: DbPool, id: string): Promise<Deal> {
  const deal = await getDealById(db, id);
  if (!deal) throw new Error('Deal not found');

  const currentIdx = STAGE_ORDER.indexOf(deal.stage);
  if (currentIdx === -1) throw new Error(`Invalid stage: ${deal.stage}`);
  if (currentIdx >= STAGE_ORDER.length - 1) throw new Error('Deal is already at the final stage');

  const nextStage = STAGE_ORDER[currentIdx + 1];
  const nextProbability = STAGE_PROBABILITY[nextStage];

  const { rows } = await db.pool.query(
    `UPDATE deals SET stage = $1, probability = $2, updated_at = now() WHERE id = $3
     RETURNING ${DEAL_COLUMNS}`,
    [nextStage, nextProbability, id]
  );
  return rows[0];
}
