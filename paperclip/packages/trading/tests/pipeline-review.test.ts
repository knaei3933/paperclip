import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbPool } from '../src/db/pool.js';

const mockConfig = {
  company: { name: 'テスト', nameKr: '테스트' },
  categories: [
    { id: 'equipment', nameJa: '設備', nameKr: '설비', baseMarginRate: 0.15 },
  ],
  exchangeRate: { KRW_JPY: 0.11, USD_JPY: 150, defaultSource: 'KRW' },
  remittanceFee: { fixedFee: 3000, percentageRate: 0.005 },
  stageProbabilities: { lead: 10, qualified: 25 },
  proposalValidityDays: 30,
  stalledDealThresholds: { lead: 14, qualified: 21, proposal: 30 },
};

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify(mockConfig)),
  existsSync: vi.fn(() => true),
}));

vi.mock('node:url', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:url')>();
  return {
    ...actual,
    fileURLToPath: vi.fn(() => '/fake/path/handler.ts'),
  };
});

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>();
  return {
    ...actual,
    join: vi.fn(() => '/fake/trading.local.json'),
    dirname: vi.fn(() => '/fake/path'),
  };
});

describe('runPipelineReview', () => {
  let mockQuery: ReturnType<typeof vi.fn>;
  let db: DbPool;

  beforeEach(() => {
    vi.resetModules();
    mockQuery = vi.fn();
    db = { pool: { query: mockQuery } } as unknown as DbPool;
  });

  it('returns empty array when all queries return no rows', async () => {
    // 3 stages in stalledDealThresholds + 1 expired + 1 follow-up = 5 queries
    mockQuery.mockResolvedValue({ rows: [] });
    const { runPipelineReview } = await import('../src/skills/pipeline-review/handler.js');
    const result = await runPipelineReview(db);
    expect(result).toEqual([]);
  });

  it('detects stalled deals per stage', async () => {
    const updatedAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000); // 20 days ago
    const stalledRow = {
      id: 'deal-1',
      title: 'Stalled Deal',
      stage: 'lead',
      customer_id: 'cust-1',
      customer_name: 'Test Customer',
      updated_at: updatedAt.toISOString(),
    };

    // lead stage returns stalled deal, other stages + expired + follow-up return empty
    mockQuery
      .mockResolvedValueOnce({ rows: [stalledRow] }) // lead
      .mockResolvedValueOnce({ rows: [] }) // qualified
      .mockResolvedValueOnce({ rows: [] }) // proposal
      .mockResolvedValueOnce({ rows: [] }) // expired
      .mockResolvedValueOnce({ rows: [] }); // follow-up

    const { runPipelineReview } = await import('../src/skills/pipeline-review/handler.js');
    const result = await runPipelineReview(db);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'stalled',
      dealId: 'deal-1',
      dealName: 'Stalled Deal',
      stage: 'lead',
      customerId: 'cust-1',
      customerName: 'Test Customer',
    });
    expect(result[0].daysSinceUpdate).toBeGreaterThanOrEqual(19);
    expect(result[0].message).toContain('Stalled Deal');
    expect(result[0].message).toContain('lead');
  });

  it('detects expired proposals', async () => {
    const updatedAt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
    const expiredRow = {
      id: 'deal-2',
      title: 'Expired Proposal',
      stage: 'proposal',
      customer_id: 'cust-2',
      customer_name: 'Customer B',
      updated_at: updatedAt.toISOString(),
    };

    // all stalled queries empty, then expired returns row, then follow-up empty
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // lead
      .mockResolvedValueOnce({ rows: [] }) // qualified
      .mockResolvedValueOnce({ rows: [] }) // proposal stalled
      .mockResolvedValueOnce({ rows: [expiredRow] }) // expired
      .mockResolvedValueOnce({ rows: [] }); // follow-up

    const { runPipelineReview } = await import('../src/skills/pipeline-review/handler.js');
    const result = await runPipelineReview(db);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'expired',
      dealId: 'deal-2',
      dealName: 'Expired Proposal',
      stage: 'proposal',
      customerId: 'cust-2',
      customerName: 'Customer B',
    });
    expect(result[0].message).toContain('expired');
  });

  it('detects follow-up needed for customers with no recent email', async () => {
    const updatedAt = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000);
    const followUpRow = {
      id: 'deal-3',
      title: 'Follow-up Deal',
      stage: 'qualified',
      customer_id: 'cust-3',
      customer_name: 'Customer C',
      updated_at: updatedAt.toISOString(),
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // lead
      .mockResolvedValueOnce({ rows: [] }) // qualified
      .mockResolvedValueOnce({ rows: [] }) // proposal
      .mockResolvedValueOnce({ rows: [] }) // expired
      .mockResolvedValueOnce({ rows: [followUpRow] }); // follow-up

    const { runPipelineReview } = await import('../src/skills/pipeline-review/handler.js');
    const result = await runPipelineReview(db);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'follow_up',
      dealId: 'deal-3',
      dealName: 'Follow-up Deal',
      stage: 'qualified',
      customerId: 'cust-3',
      customerName: 'Customer C',
    });
    expect(result[0].message).toContain('follow-up');
  });

  it('returns combined action items from all three types', async () => {
    const updatedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const makeRow = (id: string, title: string, stage: string, custId: string, custName: string) => ({
      id, title, stage, customer_id: custId, customer_name: custName, updated_at: updatedAt.toISOString(),
    });

    mockQuery
      .mockResolvedValueOnce({ rows: [makeRow('d1', 'Stalled', 'lead', 'c1', 'Cust1')] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeRow('d2', 'Expired', 'proposal', 'c2', 'Cust2')] })
      .mockResolvedValueOnce({ rows: [makeRow('d3', 'FollowUp', 'lead', 'c3', 'Cust3')] });

    const { runPipelineReview } = await import('../src/skills/pipeline-review/handler.js');
    const result = await runPipelineReview(db);

    expect(result).toHaveLength(3);
    expect(result.map(r => r.type)).toEqual(['stalled', 'expired', 'follow_up']);
  });

  it('ActionItem has correct shape with all required fields', async () => {
    const updatedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const row = {
      id: 'deal-x', title: 'X Deal', stage: 'lead',
      customer_id: 'cust-x', customer_name: 'X Customer', updated_at: updatedAt.toISOString(),
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { runPipelineReview } = await import('../src/skills/pipeline-review/handler.js');
    const result = await runPipelineReview(db);

    const item = result[0];
    expect(item).toHaveProperty('type');
    expect(item).toHaveProperty('dealId');
    expect(item).toHaveProperty('dealName');
    expect(item).toHaveProperty('stage');
    expect(item).toHaveProperty('customerId');
    expect(item).toHaveProperty('customerName');
    expect(item).toHaveProperty('daysSinceUpdate');
    expect(item).toHaveProperty('message');
    expect(typeof item.daysSinceUpdate).toBe('number');
    expect(typeof item.message).toBe('string');
  });
});
