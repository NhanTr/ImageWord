import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { config } from '../config.js';

const currentFile = fileURLToPath(import.meta.url);
const migrationsDirectory = resolve(dirname(currentFile), '../../migrations');

export async function migrate(): Promise<void> {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext('imageword_schema_migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const alreadyApplied = await client.query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = $1) AS exists',
        [file],
      );

      if (alreadyApplied.rows[0]?.exists) continue;

      const sql = await readFile(resolve(migrationsDirectory, file), 'utf8');
      await client.query('BEGIN');

      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied migration ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('imageword_schema_migrations'))");
    await client.end();
  }
}

if (process.argv[1] === currentFile) {
  migrate().catch((error: unknown) => {
    console.error('Database migration failed', error);
    process.exit(1);
  });
}
