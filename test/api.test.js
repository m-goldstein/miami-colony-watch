import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { DEFAULT_CALIBRATION, measurements, validateReading } from '../server/domain.js';
import { Store } from '../server/store.js';
import { Outbox, deliverPacket } from '../gateway/outbox.js';
let context, server, base, device, key, colony, sequence = 0;
async function request(path, body, method = 'POST', headers = {}) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
async function state() { return (await fetch(base + '/api/state')).json(); }
function packet(extra = {}) { return { schemaVersion: 1, deviceId: device.id, bootId: 'test-session', sequence: sequence++, uptimeMs: 10000,
  sampledAt: new Date().toISOString(), sonarDistanceCm: 28, sonarValidSamples: 5, rainAnalog: 900, rainDigital: 1, waterAnalog: 100, ...extra }; }
async function ingest(extra = {}) { return request('/api/readings', packet(extra), 'POST', { Authorization: `Bearer ${key}` }); }
before(async () => {
  context = createApp({ dbPath: ':memory:', demoMode: true });
  server = await new Promise(resolve => { const s = context.app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); context.store.close(); });

test('fictional seed has a coherent census; credentials are excluded from state', async () => {
  const s = await state();
  assert.equal(s.colonies.length, 6); assert.equal(s.cats.length, 80); assert.equal(s.stats.tnvr, 60);
  assert.equal(s.stats.lowFood, 1); assert.equal(s.stats.online, 5);
  assert.equal(s.devices[0].history.length, 16);
  assert.ok(!JSON.stringify(s).includes('keyHash')); assert.ok(!JSON.stringify(s).includes('demo-local-only-key'));
  assert.ok(s.colonies.every(c => c.demo));
});
test('provisioning enforces field checks and yields a scoped one-time key', async () => {
  const c = await request('/api/colonies', { name: 'Test colony', neighborhood: 'Fictional block', caretaker: 'Test caregiver' });
  assert.equal(c.status, 201); colony = c.data;
  const input = { colonyId: colony.id, name: 'Physical station', lifecycle: 'deployed', calibration: DEFAULT_CALIBRATION };
  assert.equal((await request('/api/devices', input)).status, 400);
  const provisioned = await request('/api/devices', { ...input, sitePermission: true, benchPassed: true, weatherProtected: true });
  assert.equal(provisioned.status, 201); device = provisioned.data.device; key = provisioned.data.deviceKey;
  assert.equal(key.length, 64); assert.equal(device.demo, false); assert.equal(device.measurements.foodPercent, null);
  assert.equal((await request('/api/devices', { ...input, sitePermission: true, benchPassed: true, weatherProtected: true })).status, 409);
});
test('device auth, validation, idempotency, and reboot-safe sequence identity', async () => {
  assert.equal((await request('/api/readings', packet())).status, 401);
  assert.equal((await request('/api/readings', packet(), 'POST', { Authorization: 'Bearer wrong-key' })).status, 401);
  assert.equal((await ingest({ rainAnalog: 2000 })).status, 400);
  assert.equal((await ingest({ sonarDistanceCm: null, sonarValidSamples: 5 })).status, 400);
  assert.equal((await ingest({ sampledAt: new Date(Date.now() + 600000).toISOString() })).status, 400);
  const p = packet();
  const first = await request('/api/readings', p, 'POST', { Authorization: `Bearer ${key}` });
  assert.equal(first.status, 202); assert.equal(first.data.duplicate, false);
  const duplicate = await request('/api/readings', p, 'POST', { Authorization: `Bearer ${key}` });
  assert.equal(duplicate.data.duplicate, true);
  const reboot = await request('/api/readings', { ...p, bootId: 'new-boot' }, 'POST', { Authorization: `Bearer ${key}` });
  assert.equal(reboot.data.duplicate, false);
  const s = await state(), station = s.devices.find(d => d.id === device.id);
  assert.equal(station.measurements.foodPercent, 8); assert.equal(station.measurements.source, 'hardware');
  assert.equal(s.tasks.filter(t => t.deviceId === device.id && t.type === 'food').length, 1);
});
test('no echo is unknown; old backlog cannot replace a current measurement', async () => {
  assert.equal((await ingest({ sonarDistanceCm: null, sonarValidSamples: 0 })).status, 202);
  let s = await state(); assert.equal(s.devices.find(d => d.id === device.id).measurements.foodPercent, null);
  await ingest({ sonarDistanceCm: 10 });
  await ingest({ sonarDistanceCm: 29, sampledAt: new Date(Date.now() - 3600000).toISOString() });
  s = await state(); assert.equal(s.devices.find(d => d.id === device.id).measurements.foodPercent, 80);
  const stale = measurements({ ...packet(), source: 'hardware', sampledAt: new Date(Date.now() - 3600000).toISOString() }, DEFAULT_CALIBRATION);
  assert.equal(stale.fresh, false); assert.equal(stale.foodPercent, null);
});
test('assign and complete a task; a visit changes visit evidence, not telemetry or census', async () => {
  let s = await state(); const task = s.tasks.find(t => t.deviceId === device.id && t.type === 'food');
  const assigned = await request('/api/tasks/' + task.id, { status: 'assigned', assignee: 'Test caregiver' }, 'PATCH');
  assert.equal(assigned.status, 200); assert.equal(assigned.data.status, 'assigned');
  assert.equal((await request('/api/tasks/' + task.id, { status: 'completed' }, 'PATCH')).status, 200);
  const count = s.stats.cats, before = s.devices.find(d => d.id === device.id).measurements.foodPercent;
  const visit = await request('/api/visits', { colonyId: colony.id, author: 'Test caregiver', catsSeen: 3, foodRefilled: true, waterChanged: true, notes: 'Observed refill; await sensor confirmation.' });
  assert.equal(visit.status, 201);
  s = await state(); assert.equal(s.stats.cats, count); assert.equal(s.devices.find(d => d.id === device.id).measurements.foodPercent, before);
  assert.equal(s.colonies.find(c => c.id === colony.id).lastVisitAt, visit.data.createdAt);
});
test('human observations create identities and review tasks; duplicate names and unproved TNVR are blocked', async () => {
  const body = { colonyId: colony.id, author: 'Test caregiver', newCatName: 'Test cat', description: 'Distinct white left paw', text: 'New arrival, identity needs review.' };
  assert.equal((await request('/api/observations', body)).status, 201);
  assert.equal((await request('/api/observations', body)).status, 409);
  let s = await state(); const cat = s.cats.find(c => c.name === 'Test cat');
  assert.equal(cat.tnvrStatus, 'unknown'); assert.ok(s.tasks.some(t => t.catId === cat.id && t.type === 'tnvr'));
  assert.equal((await request('/api/cats/' + cat.id, { tnvrStatus: 'confirmed' }, 'PATCH')).status, 400);
  assert.equal((await request('/api/cats/' + cat.id, { tnvrStatus: 'confirmed', evidence: 'Fictional clinic record checked by caregiver.' }, 'PATCH')).status, 200);
  assert.equal((await request('/api/observations', { colonyId: 'col-mangrove', catId: cat.id, author: 'Test', text: 'Wrong colony' })).status, 400);
});
test('calibration, origin protection, and live/demo boundaries are enforced', async () => {
  const settings = { ...device, calibration: { ...DEFAULT_CALIBRATION, foodFullCm: 30 } };
  assert.equal((await request('/api/devices/' + device.id, settings, 'PATCH')).status, 400);
  assert.equal((await request('/api/demo/scenario', { deviceId: device.id, scenario: 'refill' })).status, 403);
  assert.equal((await request('/api/demo/scenario', { deviceId: 'CW-001', scenario: 'rain' }, 'POST', { Origin: 'https://other.example' })).status, 403);
  assert.equal((await request('/api/visits', null)).status, 400);
  assert.equal((await request('/api/demo/scenario', { deviceId: 'CW-001', scenario: 'rain' })).status, 200);
  let s = await state(); assert.equal(s.devices.find(d => d.id === 'CW-001').measurements.wet, true);
  await request('/api/demo/scenario', { deviceId: 'CW-001', scenario: 'offline' });
  context.tickDemo(); s = await state(); assert.equal(s.devices.find(d => d.id === 'CW-001').online, false);
  await request('/api/demo/scenario', { deviceId: 'CW-001', scenario: 'recover' });
  s = await state(); assert.equal(s.devices.find(d => d.id === 'CW-001').online, true);
});
test('retired devices refuse readings; reports are downloadable', async () => {
  const retired = await request('/api/devices/' + device.id, { ...device, lifecycle: 'retired' }, 'PATCH');
  assert.equal(retired.status, 200); assert.equal((await ingest()).status, 409);
  const report = await fetch(base + '/api/reports/summary.csv');
  assert.equal(report.status, 200); assert.match(await report.text(), /Confirmed TNVR/);
  const research = await fetch(base + '/api/research'); assert.equal(research.status, 200); assert.match(await research.text(), /Miami-Dade/);
});
test('SQLite and gateway outbox survive process reconstruction; delivery failures preserve data', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'colony-watch-test-'));
  try {
    let db = new Store(join(dir, 'db.sqlite')); db.put('colonies', { id: 'persisted', name: 'Durable' }); db.close();
    db = new Store(join(dir, 'db.sqlite')); assert.equal(db.get('colonies', 'persisted').name, 'Durable'); db.close();
    let outbox = new Outbox(join(dir, 'outbox.jsonl')); const p = packet(); outbox.append(p);
    outbox = new Outbox(join(dir, 'outbox.jsonl')); assert.equal(outbox.items.length, 1);
    await assert.rejects(deliverPacket({ apiUrl: base, deviceKey: key, packet: p, fetchFn: async () => ({ ok: false, status: 503 }) }), /503/);
    assert.equal(outbox.items.length, 1);
    const ack = await deliverPacket({ apiUrl: base, deviceKey: key, packet: p, fetchFn: async () => ({ ok: true, json: async () => ({ accepted: true, duplicate: true }) }) });
    assert.equal(ack.duplicate, true); outbox.acknowledge(1);
    assert.equal(new Outbox(join(dir, 'outbox.jsonl')).items.length, 0);
    assert.ok(!readFileSync(join(dir, 'outbox.jsonl'), 'utf8').includes(key));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('clean hardware-only mode starts without fabricated colonies', async () => {
  const clean = createApp({ dbPath: ':memory:', demoMode: false });
  assert.equal(clean.store.list('colonies').length, 0); clean.tickDemo(); assert.equal(clean.store.list('devices').length, 0); clean.store.close();
  assert.throws(() => validateReading({ ...packet(), sampledAt: new Date(Date.now() - 8 * 86400000).toISOString() }), /past 7 days/);
});
