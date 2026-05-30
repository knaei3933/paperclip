import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbPool } from '../src/db/pool.js';

const mockConfig = {
  company: { name: 'テスト', nameKr: '테스트' },
  categories: [
    { id: 'equipment', nameJa: '設備', nameKr: '설비', baseMarginRate: 0.15 },
    { id: 'construction', nameJa: '工事', nameKr: '공사', baseMarginRate: 0.30 },
    { id: 'packaging', nameJa: '包装材', nameKr: '연포장재', baseMarginRate: 0.225 },
  ],
  exchangeRate: { KRW_JPY: 0.11, USD_JPY: 150, defaultSource: 'KRW' },
  remittanceFee: { fixedFee: 3000, percentageRate: 0.005 },
  stageProbabilities: { lead: 10, qualified: 25, proposal: 40 },
  proposalValidityDays: 30,
  stalledDealThresholds: { lead: 14 },
};

function createMockDb(queryMock?: ReturnType<typeof vi.fn>): DbPool {
  return { pool: { query: queryMock ?? vi.fn() } } as unknown as DbPool;
}

describe('createProposalDraft handler', () => {
  let mockQuery: ReturnType<typeof vi.fn>;
  let db: DbPool;
  let getCustomerByIdMock: ReturnType<typeof vi.fn>;
  let getDealByIdMock: ReturnType<typeof vi.fn>;
  let extractTextFromPdfMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    // Re-mock after resetModules so factories produce fresh vi.fn()
    vi.doMock('../src/customers/customer.service.js', () => ({
      getCustomerById: vi.fn(),
    }));
    vi.doMock('../src/deals/deal.service.js', () => ({
      getDealById: vi.fn(),
    }));
    vi.doMock('../src/manufacturers/manufacturer.service.js', () => ({
      getManufacturerById: vi.fn(),
    }));
    vi.doMock('../src/documents/pdf-extractor.js', () => ({
      extractTextFromPdf: vi.fn(),
    }));
    vi.doMock('node:fs', () => ({
      readFileSync: vi.fn(() => JSON.stringify(mockConfig)),
    }));
    vi.doMock('node:url', async (orig: () => any) => {
      const actual = await orig();
      return { ...actual, fileURLToPath: vi.fn(() => '/fake/handler.ts') };
    });
    vi.doMock('node:path', async (orig: () => any) => {
      const actual = await orig();
      return { ...actual, join: vi.fn(() => '/fake/trading.local.json'), dirname: vi.fn(() => '/fake') };
    });

    mockQuery = vi.fn();
    db = createMockDb(mockQuery);

    // Import mocks after doMock
    const cs = await import('../src/customers/customer.service.js');
    getCustomerByIdMock = cs.getCustomerById as ReturnType<typeof vi.fn>;
    const ds = await import('../src/deals/deal.service.js');
    getDealByIdMock = ds.getDealById as ReturnType<typeof vi.fn>;
    const pe = await import('../src/documents/pdf-extractor.js');
    extractTextFromPdfMock = pe.extractTextFromPdf as ReturnType<typeof vi.fn>;
  });

  it('returns error when customer not found', async () => {
    getCustomerByIdMock.mockResolvedValue(null);

    const { createProposalDraft } = await import('../src/skills/proposal-draft/handler.js');
    const result = await createProposalDraft(db, {
      customerId: 'bad-cust',
      dealId: 'deal-1',
      pdfFilePath: '/test.pdf',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Customer not found');
  });

  it('returns error when deal not found', async () => {
    getCustomerByIdMock.mockResolvedValue({
      id: 'cust-1', name: 'Test', email: null,
    });
    getDealByIdMock.mockResolvedValue(null);

    const { createProposalDraft } = await import('../src/skills/proposal-draft/handler.js');
    const result = await createProposalDraft(db, {
      customerId: 'cust-1',
      dealId: 'bad-deal',
      pdfFilePath: '/test.pdf',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Deal not found');
  });

  it('returns error with requiresManualInput when PDF extraction fails', async () => {
    getCustomerByIdMock.mockResolvedValue({
      id: 'cust-1', name: 'Test', email: null,
    });
    getDealByIdMock.mockResolvedValue({
      id: 'deal-1', title: 'Test Deal', manufacturerId: null, stage: 'proposal',
    });
    extractTextFromPdfMock.mockResolvedValue({
      success: false, error: 'Corrupt PDF',
    });

    const { createProposalDraft } = await import('../src/skills/proposal-draft/handler.js');
    const result = await createProposalDraft(db, {
      customerId: 'cust-1',
      dealId: 'deal-1',
      pdfFilePath: '/bad.pdf',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Corrupt PDF');
    expect(result.requiresManualInput).toBe(true);
  });

  it('returns error with requiresManualInput when no parseable items', async () => {
    getCustomerByIdMock.mockResolvedValue({
      id: 'cust-1', name: 'Test', email: null,
    });
    getDealByIdMock.mockResolvedValue({
      id: 'deal-1', title: 'Test Deal', manufacturerId: null, stage: 'proposal',
    });
    extractTextFromPdfMock.mockResolvedValue({
      success: true, text: 'Just some random text without any specs', language: 'en',
    });

    const { createProposalDraft } = await import('../src/skills/proposal-draft/handler.js');
    const result = await createProposalDraft(db, {
      customerId: 'cust-1',
      dealId: 'deal-1',
      pdfFilePath: '/empty.pdf',
    });

    expect(result.success).toBe(false);
    expect(result.requiresManualInput).toBe(true);
  });

  it('successfully creates proposal from PDF specs', async () => {
    getCustomerByIdMock.mockResolvedValue({
      id: 'cust-1', name: 'Test Customer', email: null,
    });
    getDealByIdMock.mockResolvedValue({
      id: 'deal-1', title: 'Test Deal', manufacturerId: 'equipment', stage: 'proposal',
    });
    extractTextFromPdfMock.mockResolvedValue({
      success: true,
      text: '모델: ABC-100\n가격: 1,000,000\n수량: 5',
      language: 'ko',
    });
    mockQuery.mockResolvedValue({ rows: [{ id: 'new-prop-1' }] });

    const { createProposalDraft } = await import('../src/skills/proposal-draft/handler.js');
    const result = await createProposalDraft(db, {
      customerId: 'cust-1',
      dealId: 'deal-1',
      pdfFilePath: '/spec.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.data!.items.length).toBeGreaterThan(0);
    expect(result.data!.dealId).toBe('deal-1');
    expect(result.data!.customerId).toBe('cust-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO proposal_drafts'),
      expect.any(Array)
    );
  });

  it('sets translationNeeded=true for Korean language', async () => {
    getCustomerByIdMock.mockResolvedValue({
      id: 'cust-1', name: 'Test', email: null,
    });
    getDealByIdMock.mockResolvedValue({
      id: 'deal-1', title: 'Deal', manufacturerId: 'equipment', stage: 'proposal',
    });
    extractTextFromPdfMock.mockResolvedValue({
      success: true,
      text: '모델: XYZ\n가격: 500,000₩\n수량: 2',
      language: 'ko',
    });
    mockQuery.mockResolvedValue({ rows: [{ id: 'prop-ko' }] });

    const { createProposalDraft } = await import('../src/skills/proposal-draft/handler.js');
    const result = await createProposalDraft(db, {
      customerId: 'cust-1',
      dealId: 'deal-1',
      pdfFilePath: '/ko.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.data!.translationNeeded).toBe(true);
    expect(result.data!.sourceLanguage).toBe('ko');
  });

  it('sets translationNeeded=false for Japanese language', async () => {
    getCustomerByIdMock.mockResolvedValue({
      id: 'cust-1', name: 'Test', email: null,
    });
    getDealByIdMock.mockResolvedValue({
      id: 'deal-1', title: 'Deal', manufacturerId: 'equipment', stage: 'proposal',
    });
    extractTextFromPdfMock.mockResolvedValue({
      success: true,
      text: '型式: XYZ-200\n単価: 500,000¥\n数量: 3',
      language: 'ja',
    });
    mockQuery.mockResolvedValue({ rows: [{ id: 'prop-ja' }] });

    const { createProposalDraft } = await import('../src/skills/proposal-draft/handler.js');
    const result = await createProposalDraft(db, {
      customerId: 'cust-1',
      dealId: 'deal-1',
      pdfFilePath: '/ja.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.data!.translationNeeded).toBe(false);
    expect(result.data!.sourceLanguage).toBe('ja');
  });

  it('sets translationNeeded=false for English language', async () => {
    getCustomerByIdMock.mockResolvedValue({
      id: 'cust-1', name: 'Test', email: null,
    });
    getDealByIdMock.mockResolvedValue({
      id: 'deal-1', title: 'Deal', manufacturerId: 'equipment', stage: 'proposal',
    });
    extractTextFromPdfMock.mockResolvedValue({
      success: true,
      text: 'model: ABC-300\nprice: 1000 USD\nquantity: 10',
      language: 'en',
    });
    mockQuery.mockResolvedValue({ rows: [{ id: 'prop-en' }] });

    const { createProposalDraft } = await import('../src/skills/proposal-draft/handler.js');
    const result = await createProposalDraft(db, {
      customerId: 'cust-1',
      dealId: 'deal-1',
      pdfFilePath: '/en.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.data!.translationNeeded).toBe(false);
  });
});
