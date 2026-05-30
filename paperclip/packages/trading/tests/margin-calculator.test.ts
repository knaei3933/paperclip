import { describe, it, expect } from 'vitest';
import { calculateMargin } from '../src/skills/proposal-draft/margin-calculator.js';
import type { TradingConfig } from '../src/skills/types.js';
import config from '../trading.local.json' with { type: 'json' };

const tc = config as TradingConfig;

describe('calculateMargin', () => {
  it('KRW equipment: manufacturer price with 15% margin', () => {
    const result = calculateMargin({
      manufacturerPrice: 10_000_000,
      sourceCurrency: 'KRW',
      categoryId: 'equipment',
      quantity: 1,
      config: tc,
    });

    const priceInJpy = 10_000_000 * 0.11; // 1_100_000
    const remittance = 3000 + (priceInJpy * 0.005); // 3000 + 5500 = 8500
    const unitPriceJpy = Math.ceil(priceInJpy + remittance); // 1_108_500
    const unitPriceQuoted = Math.ceil(unitPriceJpy * 1.15); // ceil(1_274_775) = 1_274_775

    expect(result.unitPriceSource).toBe(10_000_000);
    expect(result.currency).toBe('KRW');
    expect(result.marginRate).toBe(0.15);
    expect(result.unitPriceJpy).toBe(unitPriceJpy);
    expect(result.unitPriceQuoted).toBe(unitPriceQuoted);
    expect(result.subtotalJpy).toBe(unitPriceQuoted * 1);
    expect(result.quantity).toBe(1);
    expect(result.description).toBe('');
  });

  it('USD construction: manufacturer price with 30% margin', () => {
    const result = calculateMargin({
      manufacturerPrice: 1000,
      sourceCurrency: 'USD',
      categoryId: 'construction',
      quantity: 3,
      config: tc,
    });

    const priceInJpy = 1000 * 150; // 150_000
    const remittance = 3000 + (150_000 * 0.005); // 3000 + 750 = 3750
    const unitPriceJpy = Math.ceil(priceInJpy + remittance); // 153_750
    const unitPriceQuoted = Math.ceil(unitPriceJpy * 1.30); // ceil(199_875) = 199_875

    expect(result.currency).toBe('USD');
    expect(result.marginRate).toBe(0.30);
    expect(result.unitPriceJpy).toBe(unitPriceJpy);
    expect(result.unitPriceQuoted).toBe(unitPriceQuoted);
    expect(result.subtotalJpy).toBe(unitPriceQuoted * 3);
    expect(result.quantity).toBe(3);
  });

  it('JPY packaging: manufacturer price with 22.5% margin', () => {
    const result = calculateMargin({
      manufacturerPrice: 50_000,
      sourceCurrency: 'JPY',
      categoryId: 'packaging',
      quantity: 10,
      config: tc,
    });

    const priceInJpy = 50_000 * 1; // 50_000
    const remittance = 3000 + (50_000 * 0.005); // 3000 + 250 = 3250
    const unitPriceJpy = Math.ceil(priceInJpy + remittance); // 53_250
    const unitPriceQuoted = Math.ceil(unitPriceJpy * 1.225); // ceil(65_231.25) = 65_232

    expect(result.currency).toBe('JPY');
    expect(result.marginRate).toBe(0.225);
    expect(result.unitPriceJpy).toBe(unitPriceJpy);
    expect(result.unitPriceQuoted).toBe(unitPriceQuoted);
    expect(result.subtotalJpy).toBe(unitPriceQuoted * 10);
  });

  it('unknown currency falls back to rate 1', () => {
    const result = calculateMargin({
      manufacturerPrice: 1000,
      sourceCurrency: 'EUR',
      categoryId: 'equipment',
      quantity: 1,
      config: tc,
    });

    const priceInJpy = 1000 * 1; // fallback rate = 1
    const remittance = 3000 + (priceInJpy * 0.005);
    const unitPriceJpy = Math.ceil(priceInJpy + remittance);
    const unitPriceQuoted = Math.ceil(unitPriceJpy * 1.15);

    expect(result.unitPriceJpy).toBe(unitPriceJpy);
    expect(result.unitPriceQuoted).toBe(unitPriceQuoted);
  });

  it('unknown category falls back to first category margin rate', () => {
    const result = calculateMargin({
      manufacturerPrice: 100_000,
      sourceCurrency: 'KRW',
      categoryId: 'unknown-category',
      quantity: 1,
      config: tc,
    });

    expect(result.marginRate).toBe(tc.categories[0].baseMarginRate);
  });

  it('zero manufacturer price', () => {
    const result = calculateMargin({
      manufacturerPrice: 0,
      sourceCurrency: 'JPY',
      categoryId: 'equipment',
      quantity: 5,
      config: tc,
    });

    const remittance = 3000 + (0 * 0.005); // 3000
    const unitPriceJpy = Math.ceil(0 + remittance); // 3000
    const unitPriceQuoted = Math.ceil(unitPriceJpy * 1.15); // 3450

    expect(result.unitPriceSource).toBe(0);
    expect(result.unitPriceJpy).toBe(unitPriceJpy);
    expect(result.unitPriceQuoted).toBe(unitPriceQuoted);
    expect(result.subtotalJpy).toBe(unitPriceQuoted * 5);
  });

  it('large quantity produces correct subtotal', () => {
    const result = calculateMargin({
      manufacturerPrice: 1_000_000,
      sourceCurrency: 'KRW',
      categoryId: 'equipment',
      quantity: 100,
      config: tc,
    });

    expect(result.subtotalJpy).toBe(result.unitPriceQuoted * 100);
  });
});
