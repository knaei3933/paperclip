import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbPool } from '../../db/pool.js';
import type { TradingConfig, ProposalDraftData, ProposalItem, RawSpec } from '../types.js';
import { getCustomerById } from '../../customers/customer.service.js';
import { getDealById } from '../../deals/deal.service.js';
import { getManufacturerById } from '../../manufacturers/manufacturer.service.js';
import { extractTextFromPdf } from '../../documents/pdf-extractor.js';
import { calculateMargin } from './margin-calculator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config: TradingConfig = JSON.parse(
  readFileSync(join(__dirname, '../../../trading.local.json'), 'utf-8')
);

interface ProposalDraftInput {
  customerId: string;
  dealId: string;
  pdfFilePath: string;
}

interface ProposalDraftResult {
  success: boolean;
  data?: ProposalDraftData & {
    translationNeeded?: boolean;
    sourceLanguage?: 'ko' | 'ja' | 'en';
    rawSpecs?: RawSpec[];
  };
  error?: string;
  requiresManualInput?: boolean;
}

export function parseSpecsFromText(text: string): RawSpec[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const specs: RawSpec[] = [];
  let current: Partial<RawSpec> = {};

  for (const line of lines) {
    const priceMatch = line.match(/(?:가격|price|単価|금액|원|¥|₩|\\$|USD|KRW|JPY)\s*[:：]?\s*([\d,.-]+)/i);
    const qtyMatch = line.match(/(?:수량|quantity|数量|수량|EA|개|台|個)\s*[:：]?\s*([\d,]+)/i);
    const modelMatch = line.match(/(?:모델|model|型式|품목|제품명|品名)\s*[:：]?\s*(.+)/i);

    if (modelMatch) {
      if (current.modelName || current.specifications) {
        specs.push(current as RawSpec);
      }
      current = { modelName: modelMatch[1].trim() };
    } else if (priceMatch) {
      const rawPrice = priceMatch[1].replace(/,/g, '');
      current.unitPrice = parseFloat(rawPrice);
      if (line.includes('₩') || line.includes('KRW') || /[가-힯]/.test(line)) {
        current.currency = 'KRW';
      } else if (line.includes('¥') || /[ぁ-ゞァ-ヿ]/.test(line)) {
        current.currency = 'JPY';
      } else {
        current.currency = 'USD';
      }
    } else if (qtyMatch) {
      current.quantity = parseInt(qtyMatch[1].replace(/,/g, ''), 10);
    } else if (line.length > 10) {
      current.specifications = (current.specifications ? current.specifications + '\n' : '') + line;
    }
  }

  if (current.modelName || current.specifications) {
    specs.push(current as RawSpec);
  }

  return specs;
}

export function detectCurrency(rawSpecs: RawSpec[]): string {
  for (const spec of rawSpecs) {
    if (spec.currency) return spec.currency;
  }
  return 'USD';
}

export async function createProposalDraft(
  db: DbPool,
  input: ProposalDraftInput,
): Promise<ProposalDraftResult> {
  const customer = await getCustomerById(db, input.customerId);
  if (!customer) {
    return { success: false, error: `Customer not found: ${input.customerId}` };
  }

  const deal = await getDealById(db, input.dealId);
  if (!deal) {
    return { success: false, error: `Deal not found: ${input.dealId}` };
  }

  const extraction = await extractTextFromPdf(input.pdfFilePath);
  if (!extraction.success || !extraction.text) {
    return {
      success: false,
      error: extraction.error ?? 'PDF extraction failed',
      requiresManualInput: true,
    };
  }

  const rawSpecs = parseSpecsFromText(extraction.text);
  const sourceCurrency = detectCurrency(rawSpecs);

  const items: ProposalItem[] = [];
  for (const spec of rawSpecs) {
    if (!spec.unitPrice) continue;

    const item = calculateMargin({
      manufacturerPrice: spec.unitPrice,
      sourceCurrency,
      categoryId: deal.manufacturerId ?? 'default',
      quantity: spec.quantity ?? 1,
      config,
    });
    item.description = spec.modelName ?? spec.specifications?.slice(0, 80) ?? 'Equipment item';
    items.push(item);
  }

  if (items.length === 0) {
    return {
      success: false,
      error: 'Could not parse any items from PDF',
      requiresManualInput: true,
    };
  }

  const draftData: ProposalDraftData & {
    translationNeeded?: boolean;
    sourceLanguage?: 'ko' | 'ja' | 'en';
    rawSpecs?: RawSpec[];
  } = {
    dealId: input.dealId,
    customerId: input.customerId,
    manufacturerId: deal.manufacturerId ?? undefined,
    items,
    translationNeeded: extraction.language !== 'ja' && extraction.language !== 'en',
    sourceLanguage: extraction.language,
    rawSpecs,
  };

  const { rows } = await db.pool.query(
    `INSERT INTO proposal_drafts (deal_id, customer_id, manufacturer_id, items, status, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'draft', '', now(), now())
     RETURNING id`,
    [input.dealId, input.customerId, deal.manufacturerId, JSON.stringify(items)]
  );

  const proposalId = rows[0]?.id;
  return {
    success: true,
    data: { ...draftData, id: proposalId } as any,
  };
}
