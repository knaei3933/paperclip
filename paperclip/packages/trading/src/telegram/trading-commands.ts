import type { DbPool } from '../db/pool.js';
import type { Deal, DealStage } from '../deals/deal.service.js';
import { listDeals } from '../deals/deal.service.js';
import { listCustomers, type Customer } from '../customers/customer.service.js';
import { listEquipment } from '../equipment/equipment.service.js';

export interface TelegramResponse {
  text: string;
  reply_markup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
}

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'リード',
  qualified: '有望',
  proposal: '提案',
  negotiation: '交渉中',
  contract: '契約',
  delivery: '納品',
  installation: '設置',
  complete: '完了',
  as: 'AS',
};

const STAGE_ORDER: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'contract', 'delivery', 'installation', 'complete', 'as'];

export async function handleDealsCommand(db: DbPool): Promise<TelegramResponse> {
  const deals = await listDeals(db);

  if (deals.length === 0) {
    return { text: '📭 アクティブな案件はありません。' };
  }

  const stageCounts: Record<string, number> = {};
  for (const stage of STAGE_ORDER) {
    stageCounts[stage] = 0;
  }
  for (const deal of deals) {
    stageCounts[deal.stage] = (stageCounts[deal.stage] ?? 0) + 1;
  }

  const lines = [`📋 *案件一覧* (全${deals.length}件)`, ''];

  for (const stage of STAGE_ORDER) {
    const count = stageCounts[stage] ?? 0;
    if (count > 0) {
      const label = STAGE_LABELS[stage];
      lines.push(`▸ ${label}: ${count}件`);
    }
  }

  lines.push('', '_詳細はダッシュボードで確認できます_');

  return { text: lines.join('\n') };
}

export async function handleProposalCommand(db: DbPool): Promise<TelegramResponse> {
  const customers = await listCustomers(db);

  if (customers.length === 0) {
    return { text: '📭 顧客が登録されていません。先に顧客を追加してください。' };
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < customers.length; i += 2) {
    const row: Array<{ text: string; callback_data: string }> = [];
    for (let j = i; j < Math.min(i + 2, customers.length); j++) {
      const c = customers[j];
      row.push({
        text: c.name,
        callback_data: `proposal_customer:${c.id}`,
      });
    }
    buttons.push(row);
  }

  return {
    text: '📝 提案書を作成する顧客を選択してください:',
    reply_markup: { inline_keyboard: buttons },
  };
}

export async function handleProposalCustomerSelect(db: DbPool, customerId: string): Promise<TelegramResponse> {
  const { getCustomerById } = await import('../customers/customer.service.js');
  const customer = await getCustomerById(db, customerId);
  if (!customer) {
    return { text: '❌ 顧客が見つかりません。' };
  }

  const equipment = await listEquipment(db);
  if (equipment.length === 0) {
    return { text: `❌ 機材が登録されていません。先に機材を追加してください。\n顧客: ${customer.name}` };
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < equipment.length; i += 2) {
    const row: Array<{ text: string; callback_data: string }> = [];
    for (let j = i; j < Math.min(i + 2, equipment.length); j++) {
      const eq = equipment[j];
      const label = eq.nameJa ?? eq.name;
      row.push({
        text: label,
        callback_data: `proposal_equip:${customerId}:${eq.id}`,
      });
    }
    buttons.push(row);
  }

  return {
    text: `🔧 顧客「${customer.name}」の提案対象機材を選択してください:`,
    reply_markup: { inline_keyboard: buttons },
  };
}

export async function handleCustomerCommand(db: DbPool, searchName: string): Promise<TelegramResponse> {
  if (!searchName.trim()) {
    return { text: 'Usage: /customer <顧客名>\n例: /customer 東京商事' };
  }

  const customers = await listCustomers(db);
  const normalized = searchName.toLowerCase().replace(/\s+/g, '');

  const matches = customers.filter(c => {
    const nameNorm = c.name.toLowerCase().replace(/\s+/g, '');
    const kanaNorm = (c.nameKana ?? '').toLowerCase().replace(/\s+/g, '');
    return nameNorm.includes(normalized) || kanaNorm.includes(normalized);
  });

  if (matches.length === 0) {
    return { text: `❌ 「${searchName}」に一致する顧客が見つかりません。` };
  }

  const lines = [`🔍 検索結果: ${searchName} (${matches.length}件)`, ''];

  for (const c of matches.slice(0, 5)) {
    lines.push(`*${c.name}*`);
    if (c.contactName) lines.push(`  担当: ${c.contactName}`);
    if (c.industry) lines.push(`  業種: ${c.industry}`);
    if (c.phone) lines.push(`  電話: ${c.phone}`);
    lines.push('');
  }

  if (matches.length > 5) {
    lines.push(`_他${matches.length - 5}件_`);
  }

  return { text: lines.join('\n') };
}

export function handleHelpCommand(): TelegramResponse {
  const lines = [
    '* Kanei Trading Bot コマンド一覧*',
    '',
    '/deals - アクティブな案件一覧',
    '/proposal - 提案書作成フロー開始',
    '/customer <名前> - 顧客検索',
    '/help - ヘルプ表示',
  ];
  return { text: lines.join('\n') };
}

export async function handleTradingCommand(db: DbPool, text: string): Promise<TelegramResponse | null> {
  const trimmed = text.trim();

  if (trimmed === '/deals' || trimmed.startsWith('/deals ')) {
    return handleDealsCommand(db);
  }

  if (trimmed === '/proposal' || trimmed.startsWith('/proposal ')) {
    return handleProposalCommand(db);
  }

  if (trimmed.startsWith('/customer ')) {
    const name = trimmed.slice('/customer '.length);
    return handleCustomerCommand(db, name);
  }

  if (trimmed === '/customer') {
    return { text: 'Usage: /customer <顧客名>\n例: /customer 東京商事' };
  }

  if (trimmed.startsWith('/')) {
    return handleHelpCommand();
  }

  return null;
}
