import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradingApiRouter } from '../src/api/trading-api-router.js';
import type { ProposalDraftRecord } from '../src/skills/proposal-draft/proposal-draft.service.js';

function mockPool(queryResult: any = { rows: [] }) {
  return {
    query: vi.fn().mockResolvedValue(queryResult),
  } as any;
}

function mockRequest(method: string, url: string, body?: any): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function findRoute(router: TradingApiRouter, method: string, path: string) {
  return router.routes.find(
    (r) => r.method === method && r.pattern.test(path.replace(/:([^/]+)/g, 'test-id')),
  );
}

describe('TradingApiRouter - Proposal routes', () => {
  let pool: ReturnType<typeof mockPool>;
  let router: TradingApiRouter;

  const sampleProposal: ProposalDraftRecord = {
    id: 'prop-1',
    dealId: 'deal-1',
    customerId: 'cust-1',
    manufacturerId: 'mfg-1',
    items: [],
    status: 'draft',
    notes: '',
    pdfPath: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    pool = mockPool();
    router = new TradingApiRouter(pool);
  });

  it('GET /proposals/:id returns proposal when found', async () => {
    pool.query.mockResolvedValue({ rows: [sampleProposal] });
    const route = router.routes.find(
      (r) => r.method === 'GET' && r.pattern.test('/proposals/prop-1'),
    );
    expect(route).toBeDefined();
    const res = await route!.handler(mockRequest('GET', '/proposals/prop-1'), { id: 'prop-1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposal).toBeDefined();
    expect(body.proposal.id).toBe('prop-1');
  });

  it('GET /proposals/:id returns 404 when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const route = router.routes.find(
      (r) => r.method === 'GET' && r.pattern.test('/proposals/missing'),
    );
    expect(route).toBeDefined();
    const res = await route!.handler(mockRequest('GET', '/proposals/missing'), { id: 'missing' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('PUT /proposals/:id updates proposal', async () => {
    pool.query.mockResolvedValue({ rows: [{ ...sampleProposal, notes: 'updated' }] });
    const route = router.routes.find(
      (r) => r.method === 'PUT' && r.pattern.test('/proposals/prop-1'),
    );
    expect(route).toBeDefined();
    const res = await route!.handler(
      mockRequest('PUT', '/proposals/prop-1', { items: [], notes: 'updated' }),
      { id: 'prop-1' },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposal).toBeDefined();
  });

  it('PUT /proposals/:id returns 404 when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const route = router.routes.find(
      (r) => r.method === 'PUT' && r.pattern.test('/proposals/missing'),
    );
    expect(route).toBeDefined();
    const res = await route!.handler(
      mockRequest('PUT', '/proposals/missing', { items: [], notes: 'test' }),
      { id: 'missing' },
    );
    expect(res.status).toBe(404);
  });

  it('POST /proposals/:id/approve approves proposal', async () => {
    pool.query.mockResolvedValue({ rows: [{ ...sampleProposal, status: 'approved' }] });
    const route = router.routes.find(
      (r) => r.method === 'POST' && r.pattern.test('/proposals/prop-1/approve'),
    );
    expect(route).toBeDefined();
    const res = await route!.handler(
      mockRequest('POST', '/proposals/prop-1/approve'),
      { id: 'prop-1' },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposal.status).toBe('approved');
  });

  it('POST /proposals/:id/approve returns 404 when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const route = router.routes.find(
      (r) => r.method === 'POST' && r.pattern.test('/proposals/missing/approve'),
    );
    expect(route).toBeDefined();
    const res = await route!.handler(
      mockRequest('POST', '/proposals/missing/approve'),
      { id: 'missing' },
    );
    expect(res.status).toBe(404);
  });

  it('POST /proposals/:id/reject rejects proposal', async () => {
    pool.query.mockResolvedValue({ rows: [{ ...sampleProposal, status: 'draft' }] });
    const route = router.routes.find(
      (r) => r.method === 'POST' && r.pattern.test('/proposals/prop-1/reject'),
    );
    expect(route).toBeDefined();
    const res = await route!.handler(
      mockRequest('POST', '/proposals/prop-1/reject'),
      { id: 'prop-1' },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposal).toBeDefined();
  });

  it('POST /proposals/:id/reject returns 404 when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const route = router.routes.find(
      (r) => r.method === 'POST' && r.pattern.test('/proposals/missing/reject'),
    );
    expect(route).toBeDefined();
    const res = await route!.handler(
      mockRequest('POST', '/proposals/missing/reject'),
      { id: 'missing' },
    );
    expect(res.status).toBe(404);
  });

  it('GET /proposals/:id/pdf returns 404 when proposal not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const route = router.routes.find(
      (r) => r.method === 'GET' && r.pattern.test('/proposals/missing/pdf'),
    );
    expect(route).toBeDefined();
    const res = await route!.handler(
      mockRequest('GET', '/proposals/missing/pdf'),
      { id: 'missing' },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });
});

describe('TradingApiRouter - route registration', () => {
  it('registers all proposal routes', () => {
    const pool = mockPool();
    const router = new TradingApiRouter(pool);
    const methods = router.routes.map((r) => `${r.method} ${r.pattern.source}`);
    expect(methods.some((m) => m.includes('proposals') && m.startsWith('GET'))).toBe(true);
    expect(methods.some((m) => m.includes('proposals') && m.startsWith('PUT'))).toBe(true);
    expect(methods.some((m) => m.includes('approve'))).toBe(true);
    expect(methods.some((m) => m.includes('reject'))).toBe(true);
    expect(methods.some((m) => m.includes('proposals') && m.includes('pdf'))).toBe(true);
  });
});
