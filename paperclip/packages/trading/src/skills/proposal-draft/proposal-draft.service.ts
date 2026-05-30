import type { DbPool } from '../../db/pool.js';
import type { ProposalDraftData, ProposalItem } from '../types.js';

export interface ProposalDraftRecord {
  id: string;
  dealId: string;
  customerId: string;
  manufacturerId: string | null;
  items: ProposalItem[];
  status: 'draft' | 'approved' | 'rejected';
  notes: string;
  pdfPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DRAFT_COLUMNS = `id, deal_id as "dealId", customer_id as "customerId", manufacturer_id as "manufacturerId", items, status, notes, pdf_path as "pdfPath", created_at as "createdAt", updated_at as "updatedAt"`;

export async function getProposalById(db: DbPool, id: string): Promise<ProposalDraftRecord | null> {
  const { rows } = await db.pool.query(
    `SELECT ${DRAFT_COLUMNS} FROM proposal_drafts WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateProposal(
  db: DbPool,
  id: string,
  data: Partial<Pick<ProposalDraftRecord, 'items' | 'notes'>>,
): Promise<ProposalDraftRecord | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.items !== undefined) {
    fields.push(`items = $${idx}`);
    values.push(JSON.stringify(data.items));
    idx++;
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${idx}`);
    values.push(data.notes);
    idx++;
  }

  if (fields.length === 0) return getProposalById(db, id);

  values.push(id);
  const { rows } = await db.pool.query(
    `UPDATE proposal_drafts SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx}
     RETURNING ${DRAFT_COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

export async function approveProposal(db: DbPool, id: string): Promise<ProposalDraftRecord | null> {
  const { rows } = await db.pool.query(
    `UPDATE proposal_drafts SET status = 'approved', updated_at = now() WHERE id = $1
     RETURNING ${DRAFT_COLUMNS}`,
    [id]
  );
  return rows[0] ?? null;
}

export async function rejectProposal(db: DbPool, id: string): Promise<ProposalDraftRecord | null> {
  const { rows } = await db.pool.query(
    `UPDATE proposal_drafts SET status = 'draft', updated_at = now() WHERE id = $1
     RETURNING ${DRAFT_COLUMNS}`,
    [id]
  );
  return rows[0] ?? null;
}
