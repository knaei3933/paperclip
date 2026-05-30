import type { DbPool } from '../db/pool.js';
import { fetchUnread, sendEmail } from './xserver-client.js';

export interface EmailRow {
  id: string;
  dealId: string | null;
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string | null;
  fromAddr: string;
  toAddr: string;
  attachments: unknown[];
  messageId: string | null;
  receivedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

const EMAIL_COLUMNS = `id, deal_id as "dealId", direction, subject, body, from_addr as "fromAddr", to_addr as "toAddr", attachments, message_id as "messageId", received_at as "receivedAt", sent_at as "sentAt", created_at as "createdAt"`;

export async function syncEmails(db: DbPool): Promise<number> {
  const messages = await fetchUnread();
  if (messages.length === 0) return 0;

  let synced = 0;
  for (const msg of messages) {
    if (!msg.messageId) continue;

    const { rows } = await db.pool.query(
      'SELECT id FROM emails WHERE message_id = $1',
      [msg.messageId]
    );
    if (rows.length > 0) continue;

    const dealId = await findDealByEmail(db, msg.from, msg.to);

    await db.pool.query(
      `INSERT INTO emails (deal_id, direction, subject, body, from_addr, to_addr, attachments, message_id, received_at)
       VALUES ($1, 'inbound', $2, $3, $4, $5, $6, $7, $8)`,
      [dealId, msg.subject, msg.body, msg.from, msg.to, JSON.stringify(msg.attachments ?? []), msg.messageId, msg.date ?? new Date()]
    );
    synced++;
  }
  return synced;
}

export async function findDealByEmail(db: DbPool, from: string, to: string): Promise<string | null> {
  const { rows } = await db.pool.query(
    `SELECT d.id FROM deals d
     JOIN customers c ON d.customer_id = c.id
     WHERE c.email = $1 OR c.email = $2
     LIMIT 1`,
    [from, to]
  );
  return rows[0]?.id ?? null;
}

export async function sendDealEmail(
  db: DbPool,
  dealId: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  await sendEmail(to, subject, body);

  await db.pool.query(
    `INSERT INTO emails (deal_id, direction, subject, body, from_addr, to_addr, sent_at)
     VALUES ($1, 'outbound', $2, $3, $4, $5, now())`,
    [dealId, subject, body, process.env.XSERVER_USER ?? '', to]
  );
}

export async function getDealEmails(db: DbPool, dealId: string): Promise<EmailRow[]> {
  const { rows } = await db.pool.query(
    `SELECT ${EMAIL_COLUMNS} FROM emails WHERE deal_id = $1 ORDER BY COALESCE(received_at, sent_at, created_at) ASC`,
    [dealId]
  );
  return rows;
}
