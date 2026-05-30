import type { TradingConfig, ProposalItem } from '../types.js';

interface MarginParams {
  manufacturerPrice: number;
  sourceCurrency: string;
  categoryId: string;
  quantity: number;
  config: TradingConfig;
}

export function calculateMargin(params: MarginParams): ProposalItem {
  const { manufacturerPrice, sourceCurrency, categoryId, quantity, config } = params;

  const exchangeRates: Record<string, number> = {
    KRW: config.exchangeRate.KRW_JPY,
    USD: config.exchangeRate.USD_JPY,
    JPY: 1,
  };
  const exchangeRate = exchangeRates[sourceCurrency] ?? 1;

  const category = config.categories.find(c => c.id === categoryId);
  const marginRate = category?.baseMarginRate ?? config.categories[0]?.baseMarginRate ?? 0.3;

  const priceInJpy = manufacturerPrice * exchangeRate;
  const remittanceFee = config.remittanceFee.fixedFee + (priceInJpy * config.remittanceFee.percentageRate);
  const unitPriceJpy = priceInJpy + remittanceFee;
  const unitPriceQuoted = Math.ceil(unitPriceJpy * (1 + marginRate));
  const subtotalJpy = unitPriceQuoted * quantity;

  return {
    description: '',
    quantity,
    unitPriceSource: manufacturerPrice,
    currency: sourceCurrency,
    unitPriceJpy: Math.ceil(unitPriceJpy),
    marginRate,
    unitPriceQuoted,
    subtotalJpy,
  };
}
