import type { DbPool } from '../db/pool.js';

export interface Manufacturer {
  id: string;
  name: string;
  nameKorean: string | null;
  country: string;
  tier: number;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  equipmentCategories: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManufacturerFilters {
  tier?: number;
  country?: string;
}

export async function listManufacturers(db: DbPool, filters?: ManufacturerFilters): Promise<Manufacturer[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.tier !== undefined) {
    conditions.push(`tier = $${idx}`);
    params.push(filters.tier);
    idx++;
  }
  if (filters?.country) {
    conditions.push(`country = $${idx}`);
    params.push(filters.country);
    idx++;
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.pool.query(
    `SELECT id, name, name_korean as "nameKorean", country, tier, contact_email as "contactEmail", contact_phone as "contactPhone", website, equipment_categories as "equipmentCategories", notes, created_at as "createdAt", updated_at as "updatedAt" FROM manufacturers ${where} ORDER BY name`,
    params
  );
  return rows;
}

export async function getManufacturerById(db: DbPool, id: string): Promise<Manufacturer | null> {
  const { rows } = await db.pool.query(
    `SELECT id, name, name_korean as "nameKorean", country, tier, contact_email as "contactEmail", contact_phone as "contactPhone", website, equipment_categories as "equipmentCategories", notes, created_at as "createdAt", updated_at as "updatedAt" FROM manufacturers WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createManufacturer(db: DbPool, data: Omit<Manufacturer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Manufacturer> {
  const { rows } = await db.pool.query(
    `INSERT INTO manufacturers (name, name_korean, country, tier, contact_email, contact_phone, website, equipment_categories, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, name, name_korean as "nameKorean", country, tier, contact_email as "contactEmail", contact_phone as "contactPhone", website, equipment_categories as "equipmentCategories", notes, created_at as "createdAt", updated_at as "updatedAt"`,
    [data.name, data.nameKorean, data.country, data.tier, data.contactEmail, data.contactPhone, data.website, data.equipmentCategories ?? [], data.notes]
  );
  return rows[0];
}

export async function updateManufacturer(db: DbPool, id: string, data: Partial<Omit<Manufacturer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Manufacturer | null> {
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
  if (fields.length === 0) return getManufacturerById(db, id);
  values.push(id);
  const { rows } = await db.pool.query(
    `UPDATE manufacturers SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx}
     RETURNING id, name, name_korean as "nameKorean", country, tier, contact_email as "contactEmail", contact_phone as "contactPhone", website, equipment_categories as "equipmentCategories", notes, created_at as "createdAt", updated_at as "updatedAt"`,
    values
  );
  return rows[0] ?? null;
}

export async function deleteManufacturer(db: DbPool, id: string): Promise<boolean> {
  const { rowCount } = await db.pool.query('DELETE FROM manufacturers WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
