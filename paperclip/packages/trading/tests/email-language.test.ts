import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../src/skills/email-auto-reply/handler.js';

describe('detectLanguage (email-auto-reply)', () => {
  it('detects Korean from Hangul text', () => {
    expect(detectLanguage('안녕하세요, 견적서를 요청드립니다.')).toBe('ko');
  });

  it('detects Korean with jamo ranges', () => {
    expect(detectLanguage('ᄀᄁᄂᄃᄄᄅ 한국어')).toBe('ko');
  });

  it('detects Japanese from Hiragana text', () => {
    expect(detectLanguage('お世話になっております。')).toBe('ja');
  });

  it('detects Japanese from Katakana text', () => {
    expect(detectLanguage('ヨロコビマセン')).toBe('ja');
  });

  it('detects English text', () => {
    expect(detectLanguage('Hello, please send me the quotation.')).toBe('en');
  });

  it('Korean takes priority over Japanese when both present', () => {
    // The email handler uses regex test, so Korean regex matches first
    const text = '안녕하세요 こんにちは';
    expect(detectLanguage(text)).toBe('ko');
  });

  it('empty string returns en', () => {
    expect(detectLanguage('')).toBe('en');
  });

  it('numbers-only returns en', () => {
    expect(detectLanguage('12345')).toBe('en');
  });
});
