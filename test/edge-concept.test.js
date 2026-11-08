import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { conceptSummary } from '../server/edge-concept.js';

async function fixture(options = {}) {
  const context = createApp({ dbPath: ':memory:', ...options });
  const server = await new Promise(resolve => { const s = context.app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (body, path = '/concept') => {
    const response = await fetch(`${base}/api/care-demo${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    return { status: response.status, data: await response.json() };
  };
  const read = async () => (await request(null, '')).data;
  return { context, request, read, close: async () => { await new Promise(resolve => server.close(resolve)); context.store.close(); } };
}

test('RFID reads group into visits, count linked identities once, and require review without adding census cats', async () => {
  const f = await fixture();
  try {
    const before = await f.read();
    for (let i = 0; i < 3; i++) assert.equal((await f.request({ action: 'read', tag: 'mango' })).status, 200);
    let state = await f.read();
    assert.equal(conceptSummary(state.edgeConcept).uniqueLinkedCats, 1);
    assert.equal(state.edgeConcept.sessions.length, 1); assert.equal(state.edgeConcept.sessions[0].readCount, 3);
    await f.request({ action: 'read', tag: 'mango', returnAfterGap: true });
    await f.request({ action: 'read', tag: 'luna' });
    state = (await f.request({ action: 'read', tag: 'unlinked' })).data;
    let summary = conceptSummary(state.edgeConcept);
    assert.equal(summary.rawReads, 6); assert.equal(summary.sessions, 4); assert.equal(summary.uniqueLinkedCats, 2); assert.equal(summary.unlinkedTags, 1);
    assert.equal((await f.request({ action: 'link', catId: 'nonexistent', reviewer: 'Test' })).status, 404);
    assert.equal((await f.request({ action: 'link', catId: 'example-cat-1', reviewer: '' })).status, 400);
    state = (await f.request({ action: 'link', catId: 'example-cat-1', reviewer: 'Caregiver test' })).data;
    summary = conceptSummary(state.edgeConcept);
    assert.equal(summary.uniqueLinkedCats, 2, 'two chip tokens linked to Mango still represent one identity');
    assert.equal(summary.unlinkedTags, 0); assert.deepEqual(state.cats, before.cats);
    assert.deepEqual(state.station, before.station); assert.deepEqual(state.visits, before.visits); assert.deepEqual(state.events, before.events);
    assert.equal((await f.request({ action: 'link', catId: 'example-cat-2', reviewer: 'Test' })).status, 409);
    assert.equal((await f.request({ action: 'read', tag: '__proto__' })).status, 400);
    assert.equal((await f.request({ action: 'read', tag: 'mango', returnAfterGap: 'true' })).status, 400);
  } finally { await f.close(); }
});

test('mock gate is bounded, idempotent, cooldown-limited and inhibited by a jam without inventing food delivery', async () => {
  const f = await fixture();
  try {
    const before = await f.read();
    for (const targetGrams of [0, 31, 5.5, '10']) assert.equal((await f.request({ action: 'dispense', requestId: 'bad', targetGrams })).status, 400);
    const body = { action: 'dispense', requestId: 'cycle-one', targetGrams: 10 };
    assert.equal((await f.request(body)).status, 200); assert.equal((await f.request(body)).status, 200);
    let state = await f.read(); assert.equal(state.edgeConcept.portions.length, 1); assert.equal(state.edgeConcept.wireless.packets.length, 1);
    assert.equal(state.edgeConcept.portions[0].measuredGrams, null); assert.equal(state.edgeConcept.portions[0].physicalActuation, false);
    assert.equal((await f.request({ ...body, requestId: 'cycle-two' })).status, 409);
    await f.request({ action: 'advance' }); await f.request({ action: 'jam' });
    assert.equal((await f.request({ ...body, requestId: 'cycle-two' })).status, 409);
    assert.equal((await f.request({ action: 'inspect', reviewer: '' })).status, 400);
    await f.request({ action: 'inspect', reviewer: 'Manual demo inspection' });
    state = (await f.request({ ...body, requestId: 'cycle-two', targetGrams: 30 })).data;
    assert.equal(state.edgeConcept.portions.length, 2); assert.equal(state.edgeConcept.dispenser.fault, null);
    assert.deepEqual(state.station, before.station); assert.deepEqual(state.readings, before.readings); assert.deepEqual(state.tasks, before.tasks);
  } finally { await f.close(); }
});

test('offline concept packets survive reload and acknowledge once even after replays, isolated from physical records', async () => {
  const f = await fixture();
  try {
    const tables = ['devices', 'cats', 'colonies', 'tasks', 'visits', 'observations'];
    const physicalBefore = Object.fromEntries(tables.map(table => [table, f.context.store.list(table)]));
    await f.request({ action: 'wireless', mode: 'lora', hubOnline: false });
    await f.request({ action: 'read', tag: 'mango' });
    await f.request({ action: 'dispense', requestId: 'offline-cycle', targetGrams: 10 });
    assert.equal((await f.request({ action: 'sync' })).status, 409);
    const offline = await f.read(); assert.equal(conceptSummary(offline.edgeConcept).queued, 2);
    assert.equal(offline.edgeConcept.wireless.mode, 'lora');
    await f.request({ action: 'wireless', mode: 'lora', hubOnline: true });
    const synced = (await f.request({ action: 'sync' })).data;
    assert.equal(conceptSummary(synced.edgeConcept).acknowledged, 2); assert.equal(conceptSummary(synced.edgeConcept).queued, 0);
    const ackTimes = synced.edgeConcept.wireless.packets.map(packet => packet.ackedAt);
    const replay = (await f.request({ action: 'replay' })).data;
    assert.deepEqual(replay.edgeConcept.wireless.packets.map(packet => packet.ackedAt), ackTimes);
    assert.equal(conceptSummary(replay.edgeConcept).acknowledged, 2);
    await f.request({ action: 'read', tag: 'luna' });
    const next = (await f.request({ action: 'sync' })).data;
    assert.equal(conceptSummary(next.edgeConcept).acknowledged, 3); assert.equal(next.edgeConcept.wireless.lastBatch.length, 1);
    assert.equal(new Set(next.edgeConcept.wireless.packets.map(packet => `${packet.bootId}:${packet.sequence}`)).size, 3);
    for (const table of tables) assert.deepEqual(f.context.store.list(table), physicalBefore[table]);
    assert.equal((await f.request({ action: 'wireless', mode: 'cellular', hubOnline: true })).status, 400);
    assert.equal((await f.request({ action: 'real-motor' })).status, 400);
  } finally { await f.close(); }
});

test('version-two exercises acquire an empty concept without losing temperature or care work; hardware-only blocks simulation', async () => {
  const f = await fixture();
  try {
    const old = await f.read(); old.version = 2; delete old.edgeConcept; old.cats[0].aliases = ['Stripey']; old.station.temperatureC = -2;
    f.context.store.put('care_demo', old);
    const migrated = await f.read(); assert.equal(migrated.version, 3); assert.equal(migrated.station.temperatureC, -2);
    assert.deepEqual(migrated.cats[0].aliases, ['Stripey']); assert.equal(conceptSummary(migrated.edgeConcept).rawReads, 0);
    assert.equal(migrated.createdAt, old.createdAt);
    await f.request({ action: 'read', tag: 'mango' });
    assert.equal((await f.request({ confirm: 'reset-fictional-exercise' }, '/reset')).status, 200);
    assert.equal(conceptSummary((await f.read()).edgeConcept).rawReads, 0);
  } finally { await f.close(); }
  const hardware = await fixture({ demoMode: false });
  try { assert.equal((await hardware.request({ action: 'dispense', requestId: 'never', targetGrams: 10 })).status, 403); }
  finally { await hardware.close(); }
});
