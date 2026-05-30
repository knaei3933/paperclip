import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbPool } from '../src/db/pool.js';

vi.mock('../src/email/email.service.js', () => ({
  syncEmails: vi.fn(),
}));

function createMockDb(queryMock?: ReturnType<typeof vi.fn>): DbPool {
  return { pool: { query: queryMock ?? vi.fn() } } as unknown as DbPool;
}

describe('checkEmails (email-auto-reply handler)', () => {
  let mockQuery: ReturnType<typeof vi.fn>;
  let db: DbPool;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery = vi.fn();
    db = createMockDb(mockQuery);
  });

  it('returns empty array when syncEmails returns 0', async () => {
    const { syncEmails } = await import('../src/email/email.service.js');
    (syncEmails as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const { checkEmails } = await import('../src/skills/email-auto-reply/handler.js');
    const result = await checkEmails(db);

    expect(result).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('queries recent inbound emails when syncEmails returns > 0', async () => {
    const { syncEmails } = await import('../src/email/email.service.js');
    (syncEmails as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    mockQuery.mockResolvedValue({ rows: [] });

    const { checkEmails } = await import('../src/skills/email-auto-reply/handler.js');
    await checkEmails(db);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("direction = 'inbound'")
    );
  });

  it('detects Korean language from subject and body', async () => {
    const { syncEmails } = await import('../src/email/email.service.js');
    (syncEmails as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'email-1',
        fromAddr: 'sender@test.com',
        toAddr: 'us@test.com',
        subject: '안녕하세요',
        body: '문의 드립니다',
        dealId: null,
      }],
    });

    const { checkEmails } = await import('../src/skills/email-auto-reply/handler.js');
    const result = await checkEmails(db);

    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('ko');
  });

  it('detects Japanese language from subject and body', async () => {
    const { syncEmails } = await import('../src/email/email.service.js');
    (syncEmails as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'email-2',
        fromAddr: 'sender@test.com',
        toAddr: 'us@test.com',
        subject: 'お問い合わせ',
        body: 'よろしくお願いします',
        dealId: null,
      }],
    });

    const { checkEmails } = await import('../src/skills/email-auto-reply/handler.js');
    const result = await checkEmails(db);

    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('ja');
  });

  it('detects English language when no CJK characters', async () => {
    const { syncEmails } = await import('../src/email/email.service.js');
    (syncEmails as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'email-3',
        fromAddr: 'sender@test.com',
        toAddr: 'us@test.com',
        subject: 'Inquiry about equipment',
        body: 'Hello, I would like to know more.',
        dealId: null,
      }],
    });

    const { checkEmails } = await import('../src/skills/email-auto-reply/handler.js');
    const result = await checkEmails(db);

    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('en');
  });

  it('fetches deal title and customer name when dealId is present', async () => {
    const { syncEmails } = await import('../src/email/email.service.js');
    (syncEmails as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'email-4',
          fromAddr: 'sender@test.com',
          toAddr: 'us@test.com',
          subject: 'Test',
          body: 'Body',
          dealId: 'deal-1',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ dealTitle: 'Equipment Deal', customerName: 'Customer A' }],
      });

    const { checkEmails } = await import('../src/skills/email-auto-reply/handler.js');
    const result = await checkEmails(db);

    expect(result).toHaveLength(1);
    expect(result[0].dealId).toBe('deal-1');
    expect(result[0].dealTitle).toBe('Equipment Deal');
    expect(result[0].customerName).toBe('Customer A');
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('leaves dealTitle and customerName undefined when no dealId', async () => {
    const { syncEmails } = await import('../src/email/email.service.js');
    (syncEmails as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'email-5',
        fromAddr: 'sender@test.com',
        toAddr: 'us@test.com',
        subject: 'Test',
        body: 'Body',
        dealId: null,
      }],
    });

    const { checkEmails } = await import('../src/skills/email-auto-reply/handler.js');
    const result = await checkEmails(db);

    expect(result).toHaveLength(1);
    expect(result[0].dealId).toBeUndefined();
    expect(result[0].dealTitle).toBeUndefined();
    expect(result[0].customerName).toBeUndefined();
    // Only the initial query, no deal lookup
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('truncates body preview at 500 characters', async () => {
    const { syncEmails } = await import('../src/email/email.service.js');
    (syncEmails as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    const longBody = 'x'.repeat(1000);
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'email-6',
        fromAddr: 'sender@test.com',
        toAddr: 'us@test.com',
        subject: 'Long body',
        body: longBody,
        dealId: null,
      }],
    });

    const { checkEmails } = await import('../src/skills/email-auto-reply/handler.js');
    const result = await checkEmails(db);

    expect(result).toHaveLength(1);
    expect(result[0].bodyPreview.length).toBe(500);
  });

  it('returns correct EmailDraft shape', async () => {
    const { syncEmails } = await import('../src/email/email.service.js');
    (syncEmails as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'email-7',
        fromAddr: 'from@test.com',
        toAddr: 'to@test.com',
        subject: 'Subject line',
        body: 'Body text',
        dealId: null,
      }],
    });

    const { checkEmails } = await import('../src/skills/email-auto-reply/handler.js');
    const result = await checkEmails(db);

    const draft = result[0];
    expect(draft).toHaveProperty('emailId', 'email-7');
    expect(draft).toHaveProperty('from', 'from@test.com');
    expect(draft).toHaveProperty('to', 'to@test.com');
    expect(draft).toHaveProperty('subject', 'Subject line');
    expect(draft).toHaveProperty('bodyPreview', 'Body text');
    expect(draft).toHaveProperty('language', 'en');
  });
});
