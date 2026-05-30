import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(join(__dirname, '../trading.local.json'), 'utf-8'),
);

describe('trading.local.json configuration', () => {
  describe('company', () => {
    it('has name and nameKr', () => {
      expect(config.company).toBeDefined();
      expect(config.company.name).toBeTypeOf('string');
      expect(config.company.name.length).toBeGreaterThan(0);
      expect(config.company.nameKr).toBeTypeOf('string');
      expect(config.company.nameKr.length).toBeGreaterThan(0);
    });
  });

  describe('categories', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(config.categories)).toBe(true);
      expect(config.categories.length).toBeGreaterThan(0);
    });

    it('each category has required fields', () => {
      for (const cat of config.categories) {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('nameJa');
        expect(cat).toHaveProperty('nameKr');
        expect(cat).toHaveProperty('baseMarginRate');
        expect(cat.id).toBeTypeOf('string');
        expect(cat.nameJa).toBeTypeOf('string');
        expect(cat.nameKr).toBeTypeOf('string');
        expect(cat.nameJa.length).toBeGreaterThan(0);
        expect(cat.nameKr.length).toBeGreaterThan(0);
      }
    });

    it('baseMarginRate is between 0 and 1', () => {
      for (const cat of config.categories) {
        expect(cat.baseMarginRate).toBeTypeOf('number');
        expect(cat.baseMarginRate).toBeGreaterThan(0);
        expect(cat.baseMarginRate).toBeLessThanOrEqual(1);
      }
    });

    it('category IDs are unique', () => {
      const ids = config.categories.map((c: any) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('exchangeRate', () => {
    it('KRW_JPY is a positive number', () => {
      expect(config.exchangeRate.KRW_JPY).toBeTypeOf('number');
      expect(config.exchangeRate.KRW_JPY).toBeGreaterThan(0);
    });

    it('USD_JPY is a positive number', () => {
      expect(config.exchangeRate.USD_JPY).toBeTypeOf('number');
      expect(config.exchangeRate.USD_JPY).toBeGreaterThan(0);
    });

    it('has defaultSource', () => {
      expect(config.exchangeRate.defaultSource).toBeTypeOf('string');
      expect(['KRW', 'USD', 'JPY']).toContain(config.exchangeRate.defaultSource);
    });
  });

  describe('remittanceFee', () => {
    it('fixedFee is non-negative', () => {
      expect(config.remittanceFee.fixedFee).toBeTypeOf('number');
      expect(config.remittanceFee.fixedFee).toBeGreaterThanOrEqual(0);
    });

    it('percentageRate is non-negative', () => {
      expect(config.remittanceFee.percentageRate).toBeTypeOf('number');
      expect(config.remittanceFee.percentageRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stageProbabilities', () => {
    it('each probability is between 0 and 100', () => {
      for (const [stage, prob] of Object.entries(config.stageProbabilities)) {
        expect(prob).toBeTypeOf('number');
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('stalledDealThresholds', () => {
    it('each threshold is a positive integer', () => {
      for (const [stage, days] of Object.entries(config.stalledDealThresholds)) {
        expect(days).toBeTypeOf('number');
        expect(days).toBeGreaterThan(0);
        expect(Number.isInteger(days)).toBe(true);
      }
    });
  });

  describe('proposalValidityDays', () => {
    it('is a positive number', () => {
      expect(config.proposalValidityDays).toBeTypeOf('number');
      expect(config.proposalValidityDays).toBeGreaterThan(0);
    });
  });
});
