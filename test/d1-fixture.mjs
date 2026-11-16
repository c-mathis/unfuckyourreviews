import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const file of ['0005_email_sequence.sql', '0006_booking_followups.sql', '0009_resolution_delivery.sql']) {
    sql.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  }
  function prepare(query) {
    let params = [];
    return {
      bind(...values) { params = values; return this; },
      async first() { return sql.prepare(query).get(...params) || null; },
      async all() { return { results: sql.prepare(query).all(...params) }; },
      async run() { const r = sql.prepare(query).run(...params); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    };
  }
  const db = { prepare, async batch(statements) { sql.exec('BEGIN'); try { const r = []; for (const s of statements) r.push(await s.run()); sql.exec('COMMIT'); return r; } catch (e) { sql.exec('ROLLBACK'); throw e; } } };
  return { sql, db };
}
