import type { DbPool } from '../../db/pool.js';
import { syncEmails } from '../../email/email.service.js';

export interface EmailDraft {
  emailId: string;
  from: string;
  to: string;
  subject: string;
  bodyPreview: string;
  language: 'ko' | 'ja' | 'en';
  dealId?: string;
  dealTitle?: string;
  customerName?: string;
}

export function detectLanguage(text: string): 'ko' | 'ja' | 'en' {
  const hangul = /[가-힯ᄀ-ᇿ]/;
  const hiraganaKatakana = /[぀-ゟ゠-ヿ]/;
  if (hangul.test(text)) return 'ko';
  if (hiraganaKatakana.test(text)) return 'ja';
  return 'en';
}

export async function checkEmails(db: DbPool): Promise<EmailDraft[]> {
  const synced = await syncEmails(db);
  if (synced === 0) return [];

  const { rows } = await db.pool.query(
    `SELECT e.id, e.from_addr as "fromAddr", e.to_addr as "toAddr",
            e.subject, e.body, e.deal_id as "dealId"
     FROM emails e
     WHERE e.direction = 'inbound'
       AND e.created_at > now() - interval '1 hour'
     ORDER BY e.received_at DESC NULLS LAST`
  );

  const drafts: EmailDraft[] = [];
  for (const row of rows) {
    const bodyPreview = (row.body ?? '').slice(0, 500);
    const language = detectLanguage(row.subject + ' ' + row.body);

    let dealTitle: string | undefined;
    let customerName: string | undefined;

    if (row.dealId) {
      const dealResult = await db.pool.query(
        `SELECT d.title as "dealTitle", c.name as "customerName"
         FROM deals d
         JOIN customers c ON d.customer_id = c.id
         WHERE d.id = $1`,
        [row.dealId]
      );
      if (dealResult.rows.length > 0) {
        dealTitle = dealResult.rows[0].dealTitle;
        customerName = dealResult.rows[0].customerName;
      }
    }

    drafts.push({
      emailId: row.id,
      from: row.fromAddr,
      to: row.toAddr,
      subject: row.subject ?? '',
      bodyPreview,
      language,
      dealId: row.dealId ?? undefined,
      dealTitle,
      customerName,
    });
  }

  return drafts;
}
