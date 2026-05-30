import { readFile } from 'node:fs/promises';

export interface ExtractionResult {
  success: boolean;
  text?: string;
  error?: string;
  language?: 'ko' | 'ja' | 'en';
}

export function detectLanguage(text: string): 'ko' | 'ja' | 'en' {
  const sample = text.slice(0, 2000);
  const hangul = (sample.match(/[가-힯]/g) ?? []).length;
  const hiragana = (sample.match(/[ぁ-ゟ]/g) ?? []).length;
  const katakana = (sample.match(/[ァ-ヿ]/g) ?? []).length;
  const japanese = hiragana + katakana;

  if (hangul > japanese && hangul > 5) return 'ko';
  if (japanese > hangul && japanese > 5) return 'ja';
  return 'en';
}

export async function extractTextFromPdf(filePath: string): Promise<ExtractionResult> {
  try {
    const pdfBuffer = await readFile(filePath);
    const pdfParse = await import('pdf-parse');
    const data = await (pdfParse as any).default(pdfBuffer);

    if (!data.text || data.text.trim().length === 0) {
      return { success: false, error: 'No extractable text found in PDF' };
    }

    const language = detectLanguage(data.text);
    return { success: true, text: data.text, language };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown PDF extraction error';
    return { success: false, error: message };
  }
}
