import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import type { ProposalDraftData, ProposalItem } from '../skills/types.js';
import type { TradingConfig } from '../skills/types.js';

const OUTPUT_DIR = join(process.cwd(), 'generated-pdfs');

let _configPath: string;
try {
  _configPath = join(dirname(fileURLToPath(import.meta.url)), '../../trading.local.json');
} catch {
  _configPath = join(process.cwd(), 'packages/trading/trading.local.json');
}
if (!existsSync(_configPath)) _configPath = join(process.cwd(), 'packages/trading/trading.local.json');
const config: TradingConfig = JSON.parse(readFileSync(_configPath, 'utf-8'));

const CJK_FONT_PATHS = [
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
  'C:\\Windows\\Fonts\\YuGothR.ttc',
  'C:\\Windows\\Fonts\\meiryo.ttc',
  'C:\\Windows\\Fonts\\msgothic.ttc',
];

function findCjkFont(): string | null {
  return CJK_FONT_PATHS.find(f => existsSync(f)) ?? null;
}

async function ensureOutputDir(): Promise<string> {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }
  return OUTPUT_DIR;
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export async function generateProposalPdf(
  data: ProposalDraftData & { customerName?: string; dealTitle?: string },
  proposalConfig: TradingConfig,
  outputPath?: string,
): Promise<string> {
  const dir = await ensureOutputDir();
  const filename = outputPath ?? `proposal-${randomUUID()}.pdf`;
  const filePath = join(dir, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  try {
    const PDFDocument = (await import('pdfkit')).default;
    const cjkFont = findCjkFont();

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    if (cjkFont) doc.font(cjkFont);

    // Header
    doc.fontSize(18).text('QUOTATION / 御見積書', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Date: ${new Date().toISOString().slice(0, 10)}`, { align: 'center' });
    doc.moveDown(1);

    // Customer info
    doc.fontSize(12).text('Customer Information', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Customer: ${data.customerName ?? '-'}`);
    doc.text(`Deal: ${data.dealTitle ?? data.dealId}`);
    doc.moveDown(1);

    // Equipment table header
    doc.fontSize(12).text('Equipment & Pricing', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const colX = [50, 300, 360, 410, 470];
    doc.fontSize(9);
    doc.text('Description', colX[0], tableTop);
    doc.text('Qty', colX[1], tableTop);
    doc.text('Unit Price', colX[2], tableTop);
    doc.text('Margin', colX[3], tableTop);
    doc.text('Subtotal', colX[4], tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
    doc.y = tableTop + 20;

    let totalJpy = 0;
    for (const item of data.items) {
      const y = doc.y;
      doc.text(item.description.slice(0, 40), colX[0], y, { width: 240 });
      doc.text(String(item.quantity), colX[1], y);
      doc.text(formatCurrency(item.unitPriceQuoted), colX[2], y);
      doc.text(`${(item.marginRate * 100).toFixed(0)}%`, colX[3], y);
      doc.text(formatCurrency(item.subtotalJpy), colX[4], y);
      totalJpy += item.subtotalJpy;
      doc.y = Math.max(doc.y, y + 18);
    }

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).text(`Total: ${formatCurrency(totalJpy)}`, { align: 'right' });

    // Trading terms
    doc.moveDown(1.5);
    doc.fontSize(12).text('Trading Terms', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9);
    doc.text('Payment Terms: T/T in advance');
    doc.text('Delivery: Per agreed schedule');
    doc.text(`Validity: ${proposalConfig.proposalValidityDays} days`);
    doc.text('Currency: JPY (Japanese Yen)');

    doc.end();
    const pdfBuffer = await done;
    await writeFile(filePath, pdfBuffer);
    return filePath;
  } catch {
    // Fallback: HTML for browser print-to-PDF
    const html = buildHtmlFallback(data, proposalConfig, totalJpy(data.items));
    const htmlFilename = filename.replace(/\.pdf$/, '.html');
    const htmlPath = join(dir, htmlFilename);
    await writeFile(htmlPath, html, 'utf-8');
    return htmlPath;
  }
}

function totalJpy(items: ProposalItem[]): number {
  return items.reduce((sum, i) => sum + i.subtotalJpy, 0);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtmlFallback(data: ProposalDraftData & { customerName?: string; dealTitle?: string }, proposalConfig: TradingConfig, total: number): string {
  const rows = data.items.map(item => `<tr>
    <td>${escapeHtml(item.description.slice(0, 60))}</td>
    <td style="text-align:right">${item.quantity}</td>
    <td style="text-align:right">¥${item.unitPriceQuoted.toLocaleString('ja-JP')}</td>
    <td style="text-align:right">${(item.marginRate * 100).toFixed(0)}%</td>
    <td style="text-align:right">¥${item.subtotalJpy.toLocaleString('ja-JP')}</td>
  </tr>`).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>Quotation</title>
<style>
body{font-family:"Noto Sans JP","Yu Gothic","Meiryo",sans-serif;padding:40px;line-height:1.8;font-size:11pt}
table{border-collapse:collapse;width:100%;margin:15px 0}
th,td{border:1px solid #999;padding:6px 10px;font-size:10pt}
th{background:#eee;text-align:left}
.right{text-align:right}
h2{border-bottom:2px solid #333;padding-bottom:4px}
</style></head>
<body>
<h2 style="text-align:center">QUOTATION / 御見積書</h2>
<p style="text-align:center;font-size:10pt">Date: ${new Date().toISOString().slice(0, 10)}</p>
<h3>Customer Information</h3>
<p>Customer: ${escapeHtml(data.customerName ?? '-')}</p>
<p>Deal: ${escapeHtml(data.dealTitle ?? data.dealId)}</p>
<h3>Equipment &amp; Pricing</h3>
<table><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Margin</th><th>Subtotal</th></tr>
${rows}
<tr><td colspan="4" style="text-align:right;font-weight:bold">Total</td><td class="right" style="font-weight:bold">¥${total.toLocaleString('ja-JP')}</td></tr>
</table>
<h3>Trading Terms</h3>
<p>Payment Terms: T/T in advance</p>
<p>Delivery: Per agreed schedule</p>
<p>Validity: ${proposalConfig.proposalValidityDays} days</p>
<p>Currency: JPY (Japanese Yen)</p>
</body></html>`;
}
