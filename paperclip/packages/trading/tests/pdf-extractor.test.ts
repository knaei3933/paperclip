import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../src/documents/pdf-extractor.js';

describe('detectLanguage (pdf-extractor)', () => {
  it('detects Korean from Hangul text', () => {
    expect(detectLanguage('이것은 한국어 텍스트입니다. 제안서 초안을 작성합니다.')).toBe('ko');
  });

  it('detects Japanese from Hiragana text', () => {
    expect(detectLanguage('これは日本語のテキストです。見積書を作成します。')).toBe('ja');
  });

  it('detects Japanese from Katakana text', () => {
    expect(detectLanguage('ペーパークリップ株式会社のカタログ')).toBe('ja');
  });

  it('detects English text', () => {
    expect(detectLanguage('This is an English text for testing purposes.')).toBe('en');
  });

  it('mixed Korean majority returns ko', () => {
    const text = '한국어 텍스트가 많이 포함되어 있습니다. 이것은 한국어입니다. 추가로 더 많은 한국어 단어들. 일본어は 조금만.';
    expect(detectLanguage(text)).toBe('ko');
  });

  it('short text with few CJK characters returns en', () => {
    expect(detectLanguage('Hello there')).toBe('en');
  });

  it('empty string returns en', () => {
    expect(detectLanguage('')).toBe('en');
  });

  it('only whitespace returns en', () => {
    expect(detectLanguage('   ')).toBe('en');
  });
});
