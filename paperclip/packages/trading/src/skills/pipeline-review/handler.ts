import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbPool } from '../../db/pool.js';
import type { ActionItem, TradingConfig } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config: TradingConfig = JSON.parse(
  readFileSync(join(__dirname, '../../../trading.local.json'), 'utf-8')
);

export async function runPipelineReview(db: DbPool): Promise<ActionItem[]> {
  const actions: ActionItem[] = [];

  // 1. Stalled deals — per stage, find deals older than threshold
  for (const [stage, days] of Object.entries(config.stalledDealThresholds)) {
    const result = await db.pool.query(
      `SELECT d.id, d.title, d.stage, d.customer_id, d.updated_at,
              c.name as customer_name
       FROM deals d
       JOIN customers c ON c.id = d.customer_id
       WHERE d.stage = $1::deal_stage
         AND d.updated_at < NOW() - ($2 || ' days')::interval
       ORDER BY d.updated_at ASC`,
      [stage, days]
    );
    for (const row of result.rows) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      actions.push({
        type: 'stalled',
        dealId: row.id,
        dealName: row.title,
        stage: row.stage,
        customerId: row.customer_id,
        customerName: row.customer_name,
        daysSinceUpdate,
        message: `Deal "${row.title}" in "${row.stage}" stage has not been updated in ${daysSinceUpdate} days (threshold: ${days} days)`,
      });
    }
  }

  // 2. Expired proposals — deals in 'proposal' stage older than proposalValidityDays
  const expiredResult = await db.pool.query(
    `SELECT d.id, d.title, d.stage, d.customer_id, d.updated_at,
            c.name as customer_name
     FROM deals d
     JOIN customers c ON c.id = d.customer_id
     WHERE d.stage = 'proposal'
       AND d.updated_at < NOW() - ($1 || ' days')::interval
     ORDER BY d.updated_at ASC`,
    [config.proposalValidityDays]
  );
  for (const row of expiredResult.rows) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    actions.push({
      type: 'expired',
      dealId: row.id,
      dealName: row.title,
      stage: row.stage,
      customerId: row.customer_id,
      customerName: row.customer_name,
      daysSinceUpdate,
      message: `Proposal for "${row.title}" expired ${daysSinceUpdate - config.proposalValidityDays} days ago (validity: ${config.proposalValidityDays} days)`,
    });
  }

  // 3. Follow-up needed — customers with deals in lead/qualified/proposal with no email in 14 days
  const followUpResult = await db.pool.query(
    `SELECT DISTINCT ON (d.id)
       d.id, d.title, d.stage, d.customer_id, d.updated_at,
       c.name as customer_name
     FROM deals d
     JOIN customers c ON c.id = d.customer_id
     LEFT JOIN emails e ON e.deal_id = d.id AND e.created_at > NOW() - '14 days'::interval
     WHERE d.stage IN ('lead', 'qualified', 'proposal')
       AND e.id IS NULL
     ORDER BY d.id, d.updated_at ASC`
  );
  for (const row of followUpResult.rows) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    actions.push({
      type: 'follow_up',
      dealId: row.id,
      dealName: row.title,
      stage: row.stage,
      customerId: row.customer_id,
      customerName: row.customer_name,
      daysSinceUpdate,
      message: `No email communication with "${row.customer_name}" in 14+ days — deal "${row.title}" in "${row.stage}" stage needs follow-up`,
    });
  }

  return actions;
}
