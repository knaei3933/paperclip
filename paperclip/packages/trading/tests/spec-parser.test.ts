import { describe, it, expect } from 'vitest';
import { parseSpecsFromText, detectCurrency } from '../src/skills/proposal-draft/handler.js';

describe('parseSpecsFromText', () => {
  it('parses Korean price pattern', () => {
    const specs = parseSpecsFromText('모델: ABC-123\n가격: 10,000,000원');
    expect(specs.length).toBeGreaterThanOrEqual(1);
    const spec = specs.find(s => s.modelName === 'ABC-123') ?? specs[0];
    expect(spec.unitPrice).toBe(10_000_000);
    expect(spec.currency).toBe('KRW');
  });

  it('parses Japanese price with yen symbol', () => {
    const specs = parseSpecsFromText('型式: XYZ-789\n単価: ¥500,000');
    expect(specs.length).toBeGreaterThanOrEqual(1);
    const spec = specs.find(s => s.modelName === 'XYZ-789') ?? specs[0];
    expect(spec.unitPrice).toBe(500_000);
    expect(spec.currency).toBe('JPY');
  });

  it('parses USD price pattern', () => {
    const specs = parseSpecsFromText('model: Widget-Pro\nUSD 1,000');
    expect(specs.length).toBeGreaterThanOrEqual(1);
    const spec = specs.find(s => s.modelName === 'Widget-Pro') ?? specs[0];
    expect(spec.unitPrice).toBe(1000);
    expect(spec.currency).toBe('USD');
  });

  it('parses quantity with EA suffix', () => {
    const specs = parseSpecsFromText('모델: DEF-456\n가격: 5,000,000\n수량: 5EA');
    expect(specs.length).toBeGreaterThanOrEqual(1);
    expect(specs[0].quantity).toBe(5);
  });

  it('parses model name from Korean label', () => {
    const specs = parseSpecsFromText('모델: ABC-123');
    expect(specs[0].modelName).toBe('ABC-123');
  });

  it('accumulates multi-line specs', () => {
    const text = [
      '모델: Item-A',
      '가격: 1,000,000',
      '수량: 3EA',
      'This is a long specification line that should be accumulated as spec detail',
      '모델: Item-B',
      '가격: 2,000,000',
    ].join('\n');
    const specs = parseSpecsFromText(text);
    expect(specs.length).toBe(2);
    expect(specs[0].modelName).toBe('Item-A');
    expect(specs[0].quantity).toBe(3);
    expect(specs[1].modelName).toBe('Item-B');
  });

  it('returns empty array for empty input', () => {
    expect(parseSpecsFromText('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(parseSpecsFromText('   \n  \n  ')).toEqual([]);
  });
});

describe('detectCurrency', () => {
  it('returns first spec currency', () => {
    const specs = [
      { currency: 'KRW' },
      { currency: 'JPY' },
    ];
    expect(detectCurrency(specs as any)).toBe('KRW');
  });

  it('defaults to USD when no specs have currency', () => {
    expect(detectCurrency([{ modelName: 'test' }] as any)).toBe('USD');
  });

  it('defaults to USD for empty array', () => {
    expect(detectCurrency([])).toBe('USD');
  });
});
