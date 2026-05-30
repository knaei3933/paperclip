import type { DbPool } from '../db/pool.js';
import { extractPlaceholders, renderTemplate } from './template-engine.js';
import { generatePdf } from './pdf-renderer.js';
import { getDealById } from '../deals/deal.service.js';
import { getCustomerById } from '../customers/customer.service.js';
import { getManufacturerById } from '../manufacturers/manufacturer.service.js';

export interface Template {
  id: string;
  name: string;
  category: string | null;
  filePath: string | null;
  content: string | null;
  placeholders: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  dealId: string | null;
  templateId: string;
  formData: Record<string, unknown>;
  renderedContent: string | null;
  pdfPath: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const TEMPLATE_COLUMNS = `id, name, category, file_path as "filePath", content, placeholders, created_at as "createdAt", updated_at as "updatedAt"`;
const DOCUMENT_COLUMNS = `id, deal_id as "dealId", template_id as "templateId", form_data as "formData", rendered_content as "renderedContent", pdf_path as "pdfPath", status, created_at as "createdAt", updated_at as "updatedAt"`;

export async function listTemplates(db: DbPool, filters?: { category?: string }): Promise<Template[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.category) {
    conditions.push(`category = $${idx}`);
    params.push(filters.category);
    idx++;
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.pool.query(
    `SELECT ${TEMPLATE_COLUMNS} FROM templates ${where} ORDER BY name`,
    params
  );
  return rows;
}

export async function getTemplateById(db: DbPool, id: string): Promise<Template | null> {
  const { rows } = await db.pool.query(
    `SELECT ${TEMPLATE_COLUMNS} FROM templates WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createDocument(
  db: DbPool,
  data: { templateId: string; formData: Record<string, string>; dealId?: string }
): Promise<Document> {
  const template = await getTemplateById(db, data.templateId);
  if (!template) throw new Error('Template not found');

  let formData = data.formData;

  // Auto-fill from deal data if dealId provided
  if (data.dealId) {
    const deal = await getDealById(db, data.dealId);
    if (deal) {
      const customer = await getCustomerById(db, deal.customerId);
      const manufacturer = deal.manufacturerId ? await getManufacturerById(db, deal.manufacturerId) : null;

      const autoFill: Record<string, string> = {
        customerName: customer?.name ?? '',
        customerContact: customer?.contactName ?? '',
        customerEmail: customer?.email ?? '',
        customerPhone: customer?.phone ?? '',
        customerAddress: customer?.address ?? '',
        manufacturerName: manufacturer?.name ?? '',
        dealTitle: deal.title,
        dealAmount: deal.amount?.toString() ?? '',
      };
      formData = { ...autoFill, ...formData };
    }
  }

  // Render template if content exists
  let renderedContent: string | null = null;
  if (template.content) {
    renderedContent = renderTemplate(template.content, formData);
  }

  const { rows } = await db.pool.query(
    `INSERT INTO documents (deal_id, template_id, form_data, rendered_content, status)
     VALUES ($1, $2, $3, $4, 'draft')
     RETURNING ${DOCUMENT_COLUMNS}`,
    [data.dealId ?? null, data.templateId, JSON.stringify(formData), renderedContent]
  );
  return rows[0];
}

export async function renderDocument(db: DbPool, documentId: string): Promise<Document> {
  const doc = await getDocumentById(db, documentId);
  if (!doc) throw new Error('Document not found');

  const template = await getTemplateById(db, doc.templateId);
  if (!template) throw new Error('Template not found');

  const renderedContent = template.content
    ? renderTemplate(template.content, doc.formData as Record<string, string>)
    : null;

  const { rows } = await db.pool.query(
    `UPDATE documents SET rendered_content = $1, status = 'rendered', updated_at = now() WHERE id = $2
     RETURNING ${DOCUMENT_COLUMNS}`,
    [renderedContent, documentId]
  );
  return rows[0];
}

export async function generateDocumentPdf(db: DbPool, documentId: string): Promise<Document> {
  const doc = await getDocumentById(db, documentId);
  if (!doc) throw new Error('Document not found');

  if (!doc.renderedContent) {
    // Render first if not yet rendered
    const rendered = await renderDocument(db, documentId);
    doc.renderedContent = rendered.renderedContent;
  }

  const pdfPath = await generatePdf(doc.renderedContent!);

  const { rows } = await db.pool.query(
    `UPDATE documents SET pdf_path = $1, status = 'generated', updated_at = now() WHERE id = $2
     RETURNING ${DOCUMENT_COLUMNS}`,
    [pdfPath, documentId]
  );
  return rows[0];
}

export async function getDocumentById(db: DbPool, id: string): Promise<Document | null> {
  const { rows } = await db.pool.query(
    `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listDocuments(db: DbPool, filters?: { dealId?: string; status?: string }): Promise<Document[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.dealId) {
    conditions.push(`deal_id = $${idx}`);
    params.push(filters.dealId);
    idx++;
  }
  if (filters?.status) {
    conditions.push(`status = $${idx}`);
    params.push(filters.status);
    idx++;
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.pool.query(
    `SELECT ${DOCUMENT_COLUMNS} FROM documents ${where} ORDER BY created_at DESC`,
    params
  );
  return rows;
}
