import { describe, it, expect } from 'vitest';
import { calculateMargin } from '../src/skills/proposal-draft/margin-calculator.js';
import { detectLanguage } from '../src/documents/pdf-extractor.js';
import { parseSpecsFromText } from '../src/skills/proposal-draft/handler.js';
import type { TradingConfig } from '../src/skills/types.js';

const sampleConfig: TradingConfig = {
  company: { name: 'Test', nameKr: '테스트' },
  categories: [
    { id: 'equipment', nameJa: '設備', nameKr: '설비', baseMarginRate: 0.15 },
  ],
  exchangeRate: { KRW_JPY: 0.11, USD_JPY: 150, defaultSource: 'KRW' },
  remittanceFee: { fixedFee: 3000, percentageRate: 0.005 },
  stageProbabilities: { lead: 10 },
  proposalValidityDays: 30,
  stalledDealThresholds: { lead: 14 },
};

const koreanSpecText = Array.from({ length: 100 }, (_, i) => {
  if (i % 10 === 0) return `모델: 테스트모델${i}`;
  if (i % 10 === 5) return `가격: ${(i + 1) * 100000}원`;
  if (i % 10 === 7) return `수량: ${i + 1}EA`;
  return `사양 설명 라인 ${i}: 이것은 테스트용 한국어 사양 텍스트입니다. 고해상도 카메라 모듈 및 렌즈 어셈블리 포함`;
}).join('\n');

const koreanSample = '한국어 텍스트 샘플입니다. 이것은 테스트용 텍스트입니다. 가격 표시 테스트 중입니다.';
const japaneseSample = 'これは日本語のテキストサンプルです。テスト用のテキストです。価格表示テスト中です。';
const englishSample = 'This is an English text sample for testing purposes. Price display test in progress.';

describe('performance benchmarks', () => {
  describe('calculateMargin', () => {
    it('10,000 iterations complete under 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        calculateMargin({
          manufacturerPrice: 1000000 + i,
          sourceCurrency: 'KRW',
          categoryId: 'equipment',
          quantity: 5,
          config: sampleConfig,
        });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('detectLanguage', () => {
    it('10,000 detections complete under 50ms', () => {
      const samples = [koreanSample, japaneseSample, englishSample];
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        detectLanguage(samples[i % 3]);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('parseSpecsFromText', () => {
    it('parses a 100-line Korean spec under 10ms', () => {
      const start = performance.now();
      const result = parseSpecsFromText(koreanSpecText);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
