import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class Outbox {
  constructor(path) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    // A corrupt journal is surfaced, never silently discarded.
    this.items = existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  }
  append(packet) { appendFileSync(this.path, JSON.stringify(packet) + '\n', { mode: 0o600, flush: true }); this.items.push(packet); }
  acknowledge(count) {
    const remaining = this.items.slice(count);
    writeFileSync(this.path + '.tmp', remaining.map(p => JSON.stringify(p) + '\n').join(''), { mode: 0o600, flush: true });
    renameSync(this.path + '.tmp', this.path);
    this.items = remaining;
  }
}

export async function deliverPacket({ apiUrl, deviceKey, packet, fetchFn = fetch }) {
  const response = await fetchFn(new URL('/api/readings', apiUrl), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceKey}` },
    body: JSON.stringify(packet), signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    const error = new Error(`Ingestion returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const body = await response.json();
  if (!body.accepted) throw new Error('Server did not acknowledge the reading');
  return body;
}
