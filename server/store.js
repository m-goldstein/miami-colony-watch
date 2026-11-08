import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const tables = new Set(['colonies', 'devices', 'cats', 'tasks', 'visits', 'observations', 'care_demo']);
export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    for (const table of tables) this.db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
    this.db.exec('CREATE TABLE IF NOT EXISTS care_photos (id TEXT PRIMARY KEY, data BLOB NOT NULL)');
    this.db.exec(`CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY, device_id TEXT NOT NULL, boot_id TEXT NOT NULL,
      sequence INTEGER NOT NULL, sampled_at TEXT NOT NULL, received_at TEXT NOT NULL,
      data TEXT NOT NULL, UNIQUE(device_id, boot_id, sequence));
      CREATE INDEX IF NOT EXISTS readings_latest ON readings(device_id, sampled_at DESC, id DESC);`);
  }
  table(name) { if (!tables.has(name)) throw new Error('Unknown collection'); return name; }
  list(table) { return this.db.prepare(`SELECT data FROM ${this.table(table)}`).all().map(row => JSON.parse(row.data)); }
  get(table, id) { const row = this.db.prepare(`SELECT data FROM ${this.table(table)} WHERE id = ?`).get(id); return row ? JSON.parse(row.data) : null; }
  put(table, data) {
    this.db.prepare(`INSERT INTO ${this.table(table)} (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(data.id, JSON.stringify(data));
    return data;
  }
  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  addReading(data, receivedAt = new Date().toISOString()) {
    return this.db.prepare('INSERT OR IGNORE INTO readings (device_id, boot_id, sequence, sampled_at, received_at, data) VALUES (?, ?, ?, ?, ?, ?)')
      .run(data.deviceId, data.bootId, data.sequence, data.sampledAt, receivedAt, JSON.stringify(data)).changes > 0;
  }
  latest(deviceId) {
    const row = this.db.prepare('SELECT data FROM readings WHERE device_id = ? ORDER BY sampled_at DESC, id DESC LIMIT 1').get(deviceId);
    return row ? JSON.parse(row.data) : null;
  }
  history(deviceId, limit = 48) {
    return this.db.prepare('SELECT data FROM readings WHERE device_id = ? ORDER BY sampled_at DESC, id DESC LIMIT ?').all(deviceId, limit).reverse().map(row => JSON.parse(row.data));
  }
  close() { this.db.close(); }
}
