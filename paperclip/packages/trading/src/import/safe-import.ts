#!/usr/bin/env node
/**
 * Safe data import utility for Paperclip Trading.
 *
 * Uses Node.js pg driver (UTF-8 native) instead of raw psql through Docker,
 * preventing the encoding chain corruption that caused garbled CJK text.
 *
 * Usage:
 *   npx tsx packages/trading/src/import/safe-import.ts <json-file>
 *   npx tsx packages/trading/src/import/safe-import.ts --table manufacturers data.json
 *
 * JSON format:
 *   {
 *     "table": "manufacturers" | "customers" | "equipment" | "deals",
 *     "data": [{ "name": "株式会社テスト", "country": "JP", ... }, ...]
 *   }
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { detectMojibake } from '@paperclip/shared-types';

const DB_URL = process.env.DATABASE_URL ?? 'postgres://paperclip:paperclip@localhost:5432/paperclip';

interface ImportSpec {
  table: string;
  data: Record<string, unknown>[];
}

const COLUMN_MAPS: Record<string, { column: string; jsonKey: string }[]> = {
  manufacturers: [
    { column: 'name', jsonKey: 'name' },
    { column: 'name_korean', jsonKey: 'nameKorean' },
    { column: 'country', jsonKey: 'country' },
    { column: 'tier', jsonKey: 'tier' },
    { column: 'contact_email', jsonKey: 'contactEmail' },
    { column: 'contact_phone', jsonKey: 'contactPhone' },
    { column: 'website', jsonKey: 'website' },
    { column: 'equipment_categories', jsonKey: 'equipmentCategories' },
    { column: 'notes', jsonKey: 'notes' },
  ],
  customers: [
    { column: 'name', jsonKey: 'name' },
    { column: 'name_kana', jsonKey: 'nameKana' },
    { column: 'contact_name', jsonKey: 'contactName' },
    { column: 'email', jsonKey: 'email' },
    { column: 'phone', jsonKey: 'phone' },
    { column: 'address', jsonKey: 'address' },
    { column: 'industry', jsonKey: 'industry' },
    { column: 'notes', jsonKey: 'notes' },
  ],
  equipment: [
    { column: 'name', jsonKey: 'name' },
    { column: 'name_ja', jsonKey: 'nameJa' },
    { column: 'manufacturer_id', jsonKey: 'manufacturerId' },
    { column: 'category_id', jsonKey: 'categoryId' },
    { column: 'specs', jsonKey: 'specs' },
    { column: 'price_range', jsonKey: 'priceRange' },
    { column: 'lead_time', jsonKey: 'leadTime' },
  ],
  deals: [
    { column: 'title', jsonKey: 'title' },
    { column: 'customer_id', jsonKey: 'customerId' },
    { column: 'manufacturer_id', jsonKey: 'manufacturerId' },
    { column: 'stage', jsonKey: 'stage' },
    { column: 'amount', jsonKey: 'amount' },
    { column: 'probability', jsonKey: 'probability' },
    { column: 'notes', jsonKey: 'notes' },
  ],
};

function validateRow(row: Record<string, unknown>, rowIdx: number): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' && value.length > 0) {
      const { detected, patterns } = detectMojibake(value);
      if (detected) {
        errors.push(`Row ${rowIdx}, field "${key}": mojibake detected (${patterns.map(p => `"${p}"`).join(', ')})`);
      }
    }
  }
  return errors;
}

async function safeImport(spec: ImportSpec): Promise<void> {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    // Verify connection and encoding
    const encResult = await pool.query('SHOW client_encoding');
    console.log(`[Import] DB client_encoding: ${encResult.rows[0].client_encoding}`);

    if (encResult.rows[0].client_encoding !== 'UTF8') {
      console.warn(`[Import] WARNING: client_encoding is not UTF8. Setting it now.`);
      await pool.query('SET client_encoding = $1', ['UTF8']);
    }

    const columnMap = COLUMN_MAPS[spec.table];
    if (!columnMap) {
      throw new Error(`Unknown table: ${spec.table}. Supported: ${Object.keys(COLUMN_MAPS).join(', ')}`);
    }

    // Validate all rows before inserting anything
    console.log(`[Import] Validating ${spec.data.length} rows for ${spec.table}...`);
    const allErrors: string[] = [];
    for (let i = 0; i < spec.data.length; i++) {
      allErrors.push(...validateRow(spec.data[i], i));
    }

    if (allErrors.length > 0) {
      console.error(`[Import] Validation failed with ${allErrors.length} error(s):`);
      for (const err of allErrors) {
        console.error(`  - ${err}`);
      }
      console.error(`[Import] No data was inserted. Fix encoding issues and try again.`);
      process.exit(1);
    }

    console.log(`[Import] Validation passed. Inserting ${spec.data.length} rows...`);

    let inserted = 0;
    for (let i = 0; i < spec.data.length; i++) {
      const row = spec.data[i];
      const fields: string[] = [];
      const placeholders: string[] = [];
      const values: unknown[] = [];

      let paramIdx = 1;
      for (const mapping of columnMap) {
        const val = row[mapping.jsonKey];
        if (val !== undefined && val !== null) {
          fields.push(mapping.column);
          placeholders.push(`$${paramIdx}`);
          values.push(val);
          paramIdx++;
        }
      }

      if (fields.length === 0) {
        console.warn(`[Import] Skipping empty row ${i}`);
        continue;
      }

      const sql = `INSERT INTO ${spec.table} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`;
      const result = await pool.query(sql, values);
      inserted++;
      console.log(`  [${i + 1}/${spec.data.length}] Inserted ${spec.table} id=${result.rows[0]?.id}`);
    }

    console.log(`[Import] Done. ${inserted}/${spec.data.length} rows inserted into ${spec.table}.`);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('--'));

  if (!filePath) {
    console.error('Usage: npx tsx packages/trading/src/import/safe-import.ts <json-file>');
    console.error('');
    console.error('JSON format:');
    console.error('  { "table": "manufacturers", "data": [{ "name": "株式会社テスト" }] }');
    process.exit(1);
  }

  const resolvedPath = join(process.cwd(), filePath);
  console.log(`[Import] Reading ${resolvedPath}...`);

  const raw = await readFile(resolvedPath, 'utf-8');
  const spec: ImportSpec = JSON.parse(raw);

  if (!spec.table || !Array.isArray(spec.data)) {
    console.error('[Import] Invalid JSON: must have "table" (string) and "data" (array)');
    process.exit(1);
  }

  await safeImport(spec);
}

main().catch(err => {
  console.error('[Import] Fatal:', err);
  process.exit(1);
});
