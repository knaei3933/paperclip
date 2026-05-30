import type { Pool } from 'pg';
import type { DbPool } from '../db/pool.js';
import { listCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } from '../customers/customer.service.js';
import { listManufacturers, getManufacturerById, createManufacturer, updateManufacturer, deleteManufacturer } from '../manufacturers/manufacturer.service.js';
import { listEquipment, getEquipmentById, createEquipment, updateEquipment, deleteEquipment } from '../equipment/equipment.service.js';
import { listDeals, getDealById, createDeal, updateDeal, deleteDeal, advanceDeal } from '../deals/deal.service.js';
import type { DealStage } from '../deals/deal.service.js';
import { listTemplates, getTemplateById } from '../documents/document.service.js';
import { createDocument, getDocumentById, listDocuments, generateDocumentPdf } from '../documents/document.service.js';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { getDealEmails, sendDealEmail, syncEmails } from '../email/email.service.js';
import { getProposalById, updateProposal, approveProposal, rejectProposal } from '../skills/proposal-draft/proposal-draft.service.js';
import { generateProposalPdf } from '../documents/proposal-template.js';
import { detectMojibake } from '@paperclip/shared-types';

function validateTextFields(body: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && value.length > 0) {
      const { detected } = detectMojibake(value);
      if (detected) {
        return `Field "${key}" contains garbled text (encoding corruption detected). Please ensure UTF-8 encoding.`;
      }
    }
  }
  return null;
}

type RouteHandler = (request: Request, params: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class TradingApiRouter {
  public routes: Route[] = [];
  private db: DbPool;

  constructor(pool: Pool) {
    this.db = { pool };
    this.registerRoutes();
  }

  private addRoute(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const pattern = path.replace(/:([^/]+)/g, () => {
      paramNames.push(paramNames.length === 0 ? path.match(/:([^/]+)/g)?.[paramNames.length]?.slice(1) ?? `p${paramNames.length}` : `p${paramNames.length}`);
      return '([^/]+)';
    });
    // Fix: re-extract param names properly
    const names: string[] = [];
    const re = path.replace(/:([^/]+)/g, (_m, name) => {
      names.push(name);
      return '([^/]+)';
    });
    this.routes.push({
      method,
      pattern: new RegExp(`^${re}$`),
      paramNames: names,
      handler,
    });
  }

  private registerRoutes(): void {
    // Customers
    this.addRoute('GET', '/customers', async (_req, _params) => {
      const items = await listCustomers(this.db);
      return Response.json({ customers: items });
    });
    this.addRoute('POST', '/customers', async (req, _params) => {
      const body = await req.json() as Record<string, unknown>;
      const encodingError = validateTextFields(body);
      if (encodingError) return Response.json({ error: encodingError }, { status: 400 });
      const item = await createCustomer(this.db, body as any);
      return Response.json({ customer: item }, { status: 201 });
    });
    this.addRoute('GET', '/customers/:id', async (_req, params) => {
      const item = await getCustomerById(this.db, params.id);
      if (!item) return Response.json({ error: 'Customer not found' }, { status: 404 });
      return Response.json({ customer: item });
    });
    this.addRoute('PUT', '/customers/:id', async (req, params) => {
      const body = await req.json() as Record<string, unknown>;
      const encodingError = validateTextFields(body);
      if (encodingError) return Response.json({ error: encodingError }, { status: 400 });
      const item = await updateCustomer(this.db, params.id, body as any);
      if (!item) return Response.json({ error: 'Customer not found' }, { status: 404 });
      return Response.json({ customer: item });
    });
    this.addRoute('DELETE', '/customers/:id', async (_req, params) => {
      const deleted = await deleteCustomer(this.db, params.id);
      if (!deleted) return Response.json({ error: 'Customer not found' }, { status: 404 });
      return Response.json({ success: true });
    });

    // Manufacturers
    this.addRoute('GET', '/manufacturers', async (req, _params) => {
      const url = new URL(req.url);
      const filters: Record<string, unknown> = {};
      const tier = url.searchParams.get('tier');
      const country = url.searchParams.get('country');
      if (tier) filters.tier = parseInt(tier, 10);
      if (country) filters.country = country;
      const items = await listManufacturers(this.db, filters as any);
      return Response.json({ manufacturers: items });
    });
    this.addRoute('POST', '/manufacturers', async (req, _params) => {
      const body = await req.json() as Record<string, unknown>;
      const encodingError = validateTextFields(body);
      if (encodingError) return Response.json({ error: encodingError }, { status: 400 });
      const item = await createManufacturer(this.db, body as any);
      return Response.json({ manufacturer: item }, { status: 201 });
    });
    this.addRoute('GET', '/manufacturers/:id', async (_req, params) => {
      const item = await getManufacturerById(this.db, params.id);
      if (!item) return Response.json({ error: 'Manufacturer not found' }, { status: 404 });
      return Response.json({ manufacturer: item });
    });
    this.addRoute('PUT', '/manufacturers/:id', async (req, params) => {
      const body = await req.json() as Record<string, unknown>;
      const encodingError = validateTextFields(body);
      if (encodingError) return Response.json({ error: encodingError }, { status: 400 });
      const item = await updateManufacturer(this.db, params.id, body as any);
      if (!item) return Response.json({ error: 'Manufacturer not found' }, { status: 404 });
      return Response.json({ manufacturer: item });
    });
    this.addRoute('DELETE', '/manufacturers/:id', async (_req, params) => {
      const deleted = await deleteManufacturer(this.db, params.id);
      if (!deleted) return Response.json({ error: 'Manufacturer not found' }, { status: 404 });
      return Response.json({ success: true });
    });

    // Equipment
    this.addRoute('GET', '/equipment', async (req, _params) => {
      const url = new URL(req.url);
      const filters: Record<string, unknown> = {};
      const manufacturerId = url.searchParams.get('manufacturerId');
      const categoryId = url.searchParams.get('categoryId');
      if (manufacturerId) filters.manufacturerId = manufacturerId;
      if (categoryId) filters.categoryId = categoryId;
      const items = await listEquipment(this.db, filters as any);
      return Response.json({ equipment: items });
    });
    this.addRoute('POST', '/equipment', async (req, _params) => {
      const body = await req.json() as Record<string, unknown>;
      const encodingError = validateTextFields(body);
      if (encodingError) return Response.json({ error: encodingError }, { status: 400 });
      const item = await createEquipment(this.db, body as any);
      return Response.json({ equipment: item }, { status: 201 });
    });
    this.addRoute('GET', '/equipment/:id', async (_req, params) => {
      const item = await getEquipmentById(this.db, params.id);
      if (!item) return Response.json({ error: 'Equipment not found' }, { status: 404 });
      return Response.json({ equipment: item });
    });
    this.addRoute('PUT', '/equipment/:id', async (req, params) => {
      const body = await req.json() as Record<string, unknown>;
      const encodingError = validateTextFields(body);
      if (encodingError) return Response.json({ error: encodingError }, { status: 400 });
      const item = await updateEquipment(this.db, params.id, body as any);
      if (!item) return Response.json({ error: 'Equipment not found' }, { status: 404 });
      return Response.json({ equipment: item });
    });
    this.addRoute('DELETE', '/equipment/:id', async (_req, params) => {
      const deleted = await deleteEquipment(this.db, params.id);
      if (!deleted) return Response.json({ error: 'Equipment not found' }, { status: 404 });
      return Response.json({ success: true });
    });

    // Deals
    this.addRoute('GET', '/deals', async (req, _params) => {
      const url = new URL(req.url);
      const filters: { stage?: DealStage; customerId?: string } = {};
      const stage = url.searchParams.get('stage');
      const customerId = url.searchParams.get('customerId');
      if (stage) filters.stage = stage as DealStage;
      if (customerId) filters.customerId = customerId;
      const items = await listDeals(this.db, filters);
      return Response.json({ deals: items });
    });
    this.addRoute('POST', '/deals', async (req, _params) => {
      const body = await req.json() as Record<string, unknown>;
      const encodingError = validateTextFields(body);
      if (encodingError) return Response.json({ error: encodingError }, { status: 400 });
      const item = await createDeal(this.db, body as any);
      return Response.json({ deal: item }, { status: 201 });
    });
    this.addRoute('GET', '/deals/:id', async (_req, params) => {
      const item = await getDealById(this.db, params.id);
      if (!item) return Response.json({ error: 'Deal not found' }, { status: 404 });
      return Response.json({ deal: item });
    });
    this.addRoute('PUT', '/deals/:id', async (req, params) => {
      const body = await req.json() as Record<string, unknown>;
      const encodingError = validateTextFields(body);
      if (encodingError) return Response.json({ error: encodingError }, { status: 400 });
      const item = await updateDeal(this.db, params.id, body as any);
      if (!item) return Response.json({ error: 'Deal not found' }, { status: 404 });
      return Response.json({ deal: item });
    });
    this.addRoute('DELETE', '/deals/:id', async (_req, params) => {
      const deleted = await deleteDeal(this.db, params.id);
      if (!deleted) return Response.json({ error: 'Deal not found' }, { status: 404 });
      return Response.json({ success: true });
    });
    this.addRoute('POST', '/deals/:id/advance', async (_req, params) => {
      try {
        const item = await advanceDeal(this.db, params.id);
        return Response.json({ deal: item });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const status = message === 'Deal not found' ? 404 : 400;
        return Response.json({ error: message }, { status });
      }
    });

    // Templates
    this.addRoute('GET', '/templates', async (req, _params) => {
      const url = new URL(req.url);
      const category = url.searchParams.get('category');
      const filters: { category?: string } = {};
      if (category) filters.category = category;
      const items = await listTemplates(this.db, filters);
      return Response.json({ templates: items });
    });
    this.addRoute('GET', '/templates/:id', async (_req, params) => {
      const item = await getTemplateById(this.db, params.id);
      if (!item) return Response.json({ error: 'Template not found' }, { status: 404 });
      return Response.json({ template: item });
    });

    // Documents
    this.addRoute('POST', '/documents', async (req, _params) => {
      try {
        const body = await req.json() as Record<string, unknown>;
        const item = await createDocument(this.db, {
          templateId: body.templateId as string,
          formData: (body.formData ?? {}) as Record<string, string>,
          dealId: body.dealId as string | undefined,
        });
        return Response.json({ document: item }, { status: 201 });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ error: message }, { status: 400 });
      }
    });
    this.addRoute('GET', '/documents', async (req, _params) => {
      const url = new URL(req.url);
      const filters: { dealId?: string; status?: string } = {};
      const dealId = url.searchParams.get('dealId');
      const status = url.searchParams.get('status');
      if (dealId) filters.dealId = dealId;
      if (status) filters.status = status;
      const items = await listDocuments(this.db, filters);
      return Response.json({ documents: items });
    });
    this.addRoute('GET', '/documents/:id', async (_req, params) => {
      const item = await getDocumentById(this.db, params.id);
      if (!item) return Response.json({ error: 'Document not found' }, { status: 404 });
      return Response.json({ document: item });
    });
    this.addRoute('GET', '/documents/:id/pdf', async (_req, params) => {
      try {
        let doc = await getDocumentById(this.db, params.id);
        if (!doc) return Response.json({ error: 'Document not found' }, { status: 404 });
        if (!doc.pdfPath) {
          doc = await generateDocumentPdf(this.db, params.id);
        }
        if (!doc.pdfPath) return Response.json({ error: 'PDF generation failed' }, { status: 500 });
        const data = await readFile(doc.pdfPath);
        const isHtml = doc.pdfPath.endsWith('.html');
        const contentType = isHtml ? 'text/html' : 'application/pdf';
        const filename = basename(doc.pdfPath);
        const encodedFilename = encodeURIComponent(filename);
        return new Response(data, {
          headers: {
            'Content-Type': isHtml ? 'text/html; charset=utf-8' : 'application/pdf',
            'Content-Disposition': `inline; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ error: message }, { status: 500 });
      }
    });

    // Deal Emails
    this.addRoute('GET', '/deals/:id/emails', async (_req, params) => {
      const dealId = params.id;
      const deal = await getDealById(this.db, dealId);
      if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });
      const emails = await getDealEmails(this.db, dealId);
      return Response.json({ emails });
    });
    this.addRoute('POST', '/deals/:id/emails', async (req, params) => {
      const dealId = params.id;
      const deal = await getDealById(this.db, dealId);
      if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });
      const body = await req.json() as { to: string; subject: string; body: string };
      if (!body.to || !body.subject) return Response.json({ error: 'to and subject are required' }, { status: 400 });
      try {
        await sendDealEmail(this.db, dealId, body.to, body.subject, body.body ?? '');
        return Response.json({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send email';
        return Response.json({ error: message }, { status: 500 });
      }
    });

    // Email Sync (internal trigger)
    this.addRoute('POST', '/emails/sync', async (_req, _params) => {
      const count = await syncEmails(this.db);
      return Response.json({ synced: count });
    });

    // Proposals
    this.addRoute('GET', '/proposals/:id', async (_req, params) => {
      const item = await getProposalById(this.db, params.id);
      if (!item) return Response.json({ error: 'Proposal not found' }, { status: 404 });
      return Response.json({ proposal: item });
    });
    this.addRoute('PUT', '/proposals/:id', async (req, params) => {
      const body = await req.json() as Record<string, unknown>;
      const encodingError = validateTextFields(body);
      if (encodingError) return Response.json({ error: encodingError }, { status: 400 });
      const item = await updateProposal(this.db, params.id, {
        items: body.items as any,
        notes: body.notes as string,
      });
      if (!item) return Response.json({ error: 'Proposal not found' }, { status: 404 });
      return Response.json({ proposal: item });
    });
    this.addRoute('POST', '/proposals/:id/approve', async (_req, params) => {
      const item = await approveProposal(this.db, params.id);
      if (!item) return Response.json({ error: 'Proposal not found' }, { status: 404 });
      return Response.json({ proposal: item });
    });
    this.addRoute('POST', '/proposals/:id/reject', async (_req, params) => {
      const item = await rejectProposal(this.db, params.id);
      if (!item) return Response.json({ error: 'Proposal not found' }, { status: 404 });
      return Response.json({ proposal: item });
    });
    this.addRoute('GET', '/proposals/:id/pdf', async (_req, params) => {
      try {
        const proposal = await getProposalById(this.db, params.id);
        if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });

        const deal = proposal.dealId ? await getDealById(this.db, proposal.dealId) : null;
        const customer = proposal.customerId ? await getCustomerById(this.db, proposal.customerId) : null;

        const pdfPath = await generateProposalPdf(
          { ...proposal, manufacturerId: proposal.manufacturerId ?? undefined, customerName: customer?.name, dealTitle: deal?.title },
          {} as any,
          proposal.pdfPath ?? undefined,
        );

        if (!proposal.pdfPath) {
          await updateProposal(this.db, params.id, { notes: undefined } as any);
        }

        const data = await readFile(pdfPath);
        const isHtml = pdfPath.endsWith('.html');
        const filename = basename(pdfPath);
        const encodedFilename = encodeURIComponent(filename);
        return new Response(data, {
          headers: {
            'Content-Type': isHtml ? 'text/html; charset=utf-8' : 'application/pdf',
            'Content-Disposition': `inline; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ error: message }, { status: 500 });
      }
    });

    // Encoding health check - scans text columns for mojibake
    this.addRoute('GET', '/encoding-check', async (_req, _params) => {
      const tables: Array<{ table: string; columns: string[] }> = [
        { table: 'customers', columns: ['name', 'name_kana', 'contact_name', 'email', 'phone', 'address', 'industry', 'notes'] },
        { table: 'manufacturers', columns: ['name', 'name_korean', 'country', 'contact_email', 'contact_phone', 'website', 'notes'] },
        { table: 'equipment', columns: ['name', 'name_ja', 'price_range', 'lead_time'] },
        { table: 'deals', columns: ['title', 'notes'] },
      ];

      const issues: Array<{ table: string; id: string; column: string; value: string; patterns: string[] }> = [];
      let totalScanned = 0;

      for (const { table, columns } of tables) {
        try {
          const colSelect = columns.map(c => `"${c}"`).join(', ');
          const { rows } = await this.db.pool.query(`SELECT id, ${colSelect} FROM ${table}`);
          totalScanned += rows.length;
          for (const row of rows) {
            for (const col of columns) {
              const val = row[col];
              if (typeof val === 'string' && val.length > 0) {
                const { detected, patterns } = detectMojibake(val);
                if (detected) {
                  issues.push({
                    table,
                    id: row.id,
                    column: col,
                    value: val.length > 50 ? val.slice(0, 50) + '...' : val,
                    patterns,
                  });
                }
              }
            }
          }
        } catch {
          // Table might not exist yet
        }
      }

      return Response.json({
        status: issues.length === 0 ? 'ok' : 'encoding_issues_found',
        tablesChecked: tables.length,
        rowsScanned: totalScanned,
        issuesFound: issues.length,
        issues,
      });
    });
  }
}
