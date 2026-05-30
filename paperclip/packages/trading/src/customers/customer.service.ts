import type { DbPool } from '../db/pool.js';

export interface Customer {
  id: string;
  name: string;
  nameKana: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function listCustomers(db: DbPool): Promise<Customer[]> {
  const { rows } = await db.pool.query(
    'SELECT id, name, name_kana as "nameKana", contact_name as "contactName", email, phone, address, industry, notes, created_at as "createdAt", updated_at as "updatedAt" FROM customers ORDER BY name'
  );
  return rows;
}

export async function getCustomerById(db: DbPool, id: string): Promise<Customer | null> {
  const { rows } = await db.pool.query(
    'SELECT id, name, name_kana as "nameKana", contact_name as "contactName", email, phone, address, industry, notes, created_at as "createdAt", updated_at as "updatedAt" FROM customers WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function createCustomer(db: DbPool, data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
  const { rows } = await db.pool.query(
    `INSERT INTO customers (name, name_kana, contact_name, email, phone, address, industry, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, name_kana as "nameKana", contact_name as "contactName", email, phone, address, industry, notes, created_at as "createdAt", updated_at as "updatedAt"`,
    [data.name, data.nameKana, data.contactName, data.email, data.phone, data.address, data.industry, data.notes]
  );
  return rows[0];
}

export async function updateCustomer(db: DbPool, id: string, data: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Customer | null> {
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
  if (fields.length === 0) return getCustomerById(db, id);
  values.push(id);
  const { rows } = await db.pool.query(
    `UPDATE customers SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx}
     RETURNING id, name, name_kana as "nameKana", contact_name as "contactName", email, phone, address, industry, notes, created_at as "createdAt", updated_at as "updatedAt"`,
    values
  );
  return rows[0] ?? null;
}

export async function deleteCustomer(db: DbPool, id: string): Promise<boolean> {
  const { rowCount } = await db.pool.query('DELETE FROM customers WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
