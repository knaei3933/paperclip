import type { DbPool } from '../db/pool.js';

export interface Equipment {
  id: string;
  name: string;
  nameJa: string | null;
  manufacturerId: string | null;
  categoryId: string | null;
  specs: Record<string, unknown>;
  priceRange: string | null;
  leadTime: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentFilters {
  manufacturerId?: string;
  categoryId?: string;
}

export async function listEquipment(db: DbPool, filters?: EquipmentFilters): Promise<Equipment[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.manufacturerId) {
    conditions.push(`manufacturer_id = $${idx}`);
    params.push(filters.manufacturerId);
    idx++;
  }
  if (filters?.categoryId) {
    conditions.push(`category_id = $${idx}`);
    params.push(filters.categoryId);
    idx++;
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.pool.query(
    `SELECT id, name, name_ja as "nameJa", manufacturer_id as "manufacturerId", category_id as "categoryId", specs, price_range as "priceRange", lead_time as "leadTime", created_at as "createdAt", updated_at as "updatedAt" FROM equipment ${where} ORDER BY name`,
    params
  );
  return rows;
}

export async function getEquipmentById(db: DbPool, id: string): Promise<Equipment | null> {
  const { rows } = await db.pool.query(
    `SELECT id, name, name_ja as "nameJa", manufacturer_id as "manufacturerId", category_id as "categoryId", specs, price_range as "priceRange", lead_time as "leadTime", created_at as "createdAt", updated_at as "updatedAt" FROM equipment WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createEquipment(db: DbPool, data: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Equipment> {
  const { rows } = await db.pool.query(
    `INSERT INTO equipment (name, name_ja, manufacturer_id, category_id, specs, price_range, lead_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, name_ja as "nameJa", manufacturer_id as "manufacturerId", category_id as "categoryId", specs, price_range as "priceRange", lead_time as "leadTime", created_at as "createdAt", updated_at as "updatedAt"`,
    [data.name, data.nameJa, data.manufacturerId, data.categoryId, JSON.stringify(data.specs ?? {}), data.priceRange, data.leadTime]
  );
  return rows[0];
}

export async function updateEquipment(db: DbPool, id: string, data: Partial<Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Equipment | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const col = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
      const paramValue = key === 'specs' ? JSON.stringify(value) : value;
      fields.push(`${col} = $${idx}`);
      values.push(paramValue);
      idx++;
    }
  }
  if (fields.length === 0) return getEquipmentById(db, id);
  values.push(id);
  const { rows } = await db.pool.query(
    `UPDATE equipment SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx}
     RETURNING id, name, name_ja as "nameJa", manufacturer_id as "manufacturerId", category_id as "categoryId", specs, price_range as "priceRange", lead_time as "leadTime", created_at as "createdAt", updated_at as "updatedAt"`,
    values
  );
  return rows[0] ?? null;
}

export async function deleteEquipment(db: DbPool, id: string): Promise<boolean> {
  const { rowCount } = await db.pool.query('DELETE FROM equipment WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
