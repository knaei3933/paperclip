import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const OUTPUT_DIR = join(process.cwd(), 'generated-pdfs');

async function ensureOutputDir(): Promise<string> {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }
  return OUTPUT_DIR;
}

export async function generatePdf(renderedContent: string, outputPath?: string): Promise<string> {
  const dir = await ensureOutputDir();
  const filename = outputPath ?? `${randomUUID()}.pdf`;
  const filePath = join(dir, filename);

  try {
    const PDFDocument = (await import('pdfkit')).default;

    // Try CJK fonts in order of preference
    const cjkFontPaths = [
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
      'C:\\Windows\\Fonts\\YuGothR.ttc',
      'C:\\Windows\\Fonts\\meiryo.ttc',
      'C:\\Windows\\Fonts\\msgothic.ttc',
    ];
    const cjkFont = cjkFontPaths.find(f => existsSync(f));

    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    if (cjkFont) {
      doc.font(cjkFont);
    }

    doc.fontSize(11);
    // Split content into lines and write them
    const lines = renderedContent.split('\n');
    for (const line of lines) {
      doc.text(line, { lineGap: 4 });
    }
    doc.end();

    const pdfBuffer = await done;
    await writeFile(filePath, pdfBuffer);
    return filePath;
  } catch {
    // Fallback: generate HTML for browser print-to-PDF
    const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>Document</title>
<style>body{font-family:"Noto Sans JP","Yu Gothic","Meiryo",sans-serif;padding:40px;line-height:1.8;white-space:pre-wrap;font-size:12pt}</style>
</head><body>${escapeHtml(renderedContent)}</body></html>`;
    const htmlFilename = filename.replace(/\.pdf$/, '.html');
    const htmlPath = join(dir, htmlFilename);
    await writeFile(htmlPath, htmlContent, 'utf-8');
    return htmlPath;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
