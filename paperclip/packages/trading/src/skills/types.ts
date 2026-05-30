import type { DbPool } from '../db/pool.js';
import type config from '../../trading.local.json';

export type TradingConfig = typeof config;

export interface SkillContext {
  db: DbPool;
  config: TradingConfig;
}

export interface SkillResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ActionItem {
  type: 'stalled' | 'expired' | 'follow_up';
  dealId: string;
  dealName: string;
  stage: string;
  customerId: string;
  customerName: string;
  daysSinceUpdate: number;
  message: string;
}

export interface ProposalDraftData {
  dealId: string;
  customerId: string;
  manufacturerId?: string;
  items: ProposalItem[];
  marginRate?: number;
  exchangeRate?: number;
  remittanceFee?: number;
  notes?: string;
}

export interface RawSpec {
  modelName?: string;
  specifications?: string;
  unitPrice?: number;
  quantity?: number;
  currency?: string;
  manufacturerName?: string;
}

export interface ProposalItem {
  description: string;
  quantity: number;
  unitPriceSource: number;
  currency: string;
  unitPriceJpy: number;
  marginRate: number;
  unitPriceQuoted: number;
  subtotalJpy: number;
}
