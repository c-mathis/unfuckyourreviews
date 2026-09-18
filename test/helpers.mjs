import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// Minimal D1-compatible adapter over node:sqlite so the handlers run real SQL.
export function d1(database) {
  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      let bound = [];
      const api = {
        bind(...params) { bound = params.map(p => (p === undefined ? null : p)); return api; },
        async run() {
          const info = statement.run(...bound);
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } };
        },
        async first() { return statement.get(...bound) ?? null; },
        async all() { return { success: true, results: statement.all(...bound) }; },
      };
      return api;
    },
    async batch(statements) { return Promise.all(statements.map(s => s.run())); },
  };
}

export function freshDatabase(migrations = ['0003_calls.sql', '0004_sms.sql']) {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  // Production gained gbp_url by hand before migrations existed; schema.sql lags it.
  database.exec('ALTER TABLE leads ADD COLUMN gbp_url TEXT');
  for (const file of migrations) {
    database.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  return database;
}
