#!/usr/bin/env node
import 'dotenv/config';
import { getPool } from '@paperclip/core';

async function runMigrations(): Promise<void> {
  const pool = getPool();

  try {
    await pool.query('SELECT 1');
    console.log('[Migrate] Connected to PostgreSQL');

    const { readdir, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const migrationDirs = [
      join(process.cwd(), 'packages', 'core', 'src', 'db', 'migrations'),
      join(process.cwd(), 'packages', 'trading', 'src', 'db', 'migrations'),
    ];

    const fileEntries: Array<{ dir: string; name: string }> = [];
    for (const dir of migrationDirs) {
      const files = await readdir(dir).catch(() => [] as string[]);
      for (const f of files.filter(f => f.endsWith('.sql'))) {
        fileEntries.push({ dir, name: f });
      }
    }
    fileEntries.sort((a, b) => a.name.localeCompare(b.name));

    await pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    );

    for (const entry of fileEntries) {
      const already = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [entry.name]);
      if (already.rows.length > 0) {
        console.log(`[Migrate] Skipping: ${entry.name}`);
        continue;
      }
      const sql = await readFile(join(entry.dir, entry.name), 'utf-8');
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [entry.name]);
      console.log(`[Migrate] Applied: ${entry.name}`);
    }

    console.log('[Migrate] All migrations complete');
  } catch (err) {
    console.error('[Migrate] Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
