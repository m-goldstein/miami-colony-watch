import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { initialCareDemo, careReport } from '../server/care-demo.js';

async function fixture(options = {}) {
  const context = createApp({ dbPath: ':memory:', ...options });
  const server = await new Promise(resolve => { const s = context.app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path = '', body, method = 'POST') => {
    const response = await fetch(`${base}/api/care-demo${path}`, { method: body === undefined ? 'GET' : method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    return { status: response.status, data: response.headers.get('content-type')?.includes('text/csv') ? await response.text() : await response.json() };
  };
  return { context, request, close: async () => { await new Promise(resolve => server.close(resolve)); context.store.close(); } };
}
const review = (decision, extra = {}) => ({ decision, reviewer: 'Test coordinator', ...extra });
const today = () => new Date().toISOString().slice(0, 10);

test('sample import is repeatable; two reviewed sightings retain one identity and an auditable alias', async () => {
  const f = await fixture();
  try {
    let result = await f.request('/import', {}); assert.equal(result.status, 200); assert.equal(result.data.updates.length, 6);
    result = await f.request('/import', {}); assert.equal(result.data.updates.length, 6); assert.equal(result.data.events.filter(e => e.kind === 'batch_imported').length, 1);
    assert.equal((await f.request('/updates/morning-01/review', review('existing', { catId: 'example-cat-1' }))).status, 200);
    result = await f.request('/updates/morning-02/review', review('existing', { catId: 'example-cat-1', alias: 'Stripey', note: 'Coordinator checked the source and markings.' }));
    assert.equal(result.data.cats.length, 14); const cat = result.data.cats.find(c => c.id === 'example-cat-1');
    assert.deepEqual(cat.aliases, ['Stripey']); assert.deepEqual(cat.observations, ['morning-01', 'morning-02']);
    assert.match(result.data.updates[1].text, /Could this be Mango/);
    assert.equal((await f.request('/updates/morning-02/review', review('existing', { catId: 'example-cat-1' }))).status, 409);
    const report = await f.request(`/report?from=${today()}&to=${today()}`);
    assert.equal(report.data.period.sightings, 2); assert.equal(report.data.period.uniqueCatsObserved, 1); assert.equal(report.data.period.procedures, 0);
  } finally { await f.close(); }
});

test('new identities require distinct names and markings; invalid decisions leave the original update pending', async () => {
  const f = await fixture();
  try {
    await f.request('/import', {});
    assert.equal((await f.request('/updates/morning-04/review', review('new', { name: 'Mango', description: 'Different wording' }))).status, 409);
    assert.equal((await f.request('/updates/morning-04/review', review('new', { name: 'Pebble', description: '' }))).status, 400);
    let state = (await f.request()).data; assert.equal(state.cats.length, 14); assert.equal(state.updates.find(u => u.id === 'morning-04').status, 'pending');
    state = (await f.request('/updates/morning-04/review', review('new', { name: 'Pebble', description: 'Black and white, left eye patch' }))).data;
    assert.equal(state.cats.length, 15); assert.equal(state.cats.at(-1).tnvrStatus, 'unknown'); assert.equal(state.tasks.at(-1).type, 'identity');
    assert.equal((await f.request('/updates/morning-05/review', review('dismiss', { note: '' }))).status, 400);
  } finally { await f.close(); }
});

test('care assignment and completion create dated visit evidence without changing census or sensor measurements', async () => {
  const f = await fixture();
  try {
    await f.request('/import', {});
    const state = (await f.request('/updates/morning-03/review', review('existing', { catId: 'example-cat-14' }))).data;
    const task = state.tasks[0], station = state.station;
    assert.equal(task.severity, 'urgent'); assert.equal(task.sourceId, 'morning-03');
    assert.equal((await f.request(`/tasks/${task.id}`, { status: 'assigned', assignee: '' }, 'PATCH')).status, 400);
    let result = await f.request(`/tasks/${task.id}`, { status: 'assigned', assignee: 'Elena', dueAt: new Date().toISOString(), note: 'Arrange an experienced caregiver review.' }, 'PATCH');
    assert.equal(result.data.visits.length, 0); assert.equal(result.data.tasks[0].assignee, 'Elena');
    assert.equal((await f.request(`/tasks/${task.id}`, { status: 'completed', assignee: 'Elena', catsSeen: 2, note: '' }, 'PATCH')).status, 400);
    result = await f.request(`/tasks/${task.id}`, { status: 'completed', assignee: 'Elena', catsSeen: 2, note: 'Checked Pippa in person and recorded the care handoff.', foodRefilled: true }, 'PATCH');
    assert.equal(result.data.visits.length, 1); assert.equal(result.data.cats.length, 14); assert.deepEqual(result.data.station, station);
    assert.equal((await f.request(`/tasks/${task.id}`, { status: 'completed', assignee: 'Elena', catsSeen: 2, note: 'Repeated' }, 'PATCH')).status, 409);
    const report = (await f.request(`/report?from=${today()}&to=${today()}`)).data;
    assert.equal(report.period.visits, 1); assert.equal(report.period.completedFollowups, 1);
  } finally { await f.close(); }
});

test('procedure evidence is required, counted by documented date, and cannot be counted twice', async () => {
  const f = await fixture();
  try {
    await f.request('/import', {}); const date = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const input = review('procedure', { catId: 'example-cat-14', procedureDate: date, reference: 'FICTIONAL-SP-014', note: 'Checked the fictional clinic record.' });
    assert.equal((await f.request('/updates/morning-06/review', { ...input, note: '' })).status, 400);
    assert.equal((await f.request('/updates/morning-06/review', { ...input, procedureDate: '2026-02-31' })).status, 400);
    let result = await f.request('/updates/morning-06/review', input); assert.equal(result.status, 200);
    assert.equal(result.data.cats.filter(c => c.tnvrStatus === 'confirmed').length, 12);
    assert.equal((await f.request(`/report?from=${date}&to=${date}`)).data.period.procedures, 1);
    assert.equal((await f.request(`/report?from=${today()}&to=${today()}`)).data.period.procedures, 0);
    const note = await f.request('/updates', { author: 'Test', text: 'Another note about that same clinic record.' }); const source = note.data.updates.at(-1);
    assert.equal((await f.request(`/updates/${source.id}/review`, input)).status, 409);
    const csv = await f.request(`/report.csv?from=${date}&to=${today()}`);
    assert.match(csv.data, /FICTIONAL-SP-014/); assert.match(csv.data, /ORIGINAL WORDS/); assert.match(csv.data, /fictional clinic note|Fictional clinic note/);
  } finally { await f.close(); }
});

test('station recovery retains human tasks; exercise reset preserves every existing workspace collection', async () => {
  const f = await fixture();
  try {
    const original = Object.fromEntries(['colonies', 'cats', 'tasks', 'visits', 'observations', 'devices'].map(key => [key, f.context.store.list(key)]));
    await f.request('/station', { scenario: 'food' }); await f.request('/station', { scenario: 'food' });
    let state = (await f.request('/station', { scenario: 'refill' })).data;
    assert.equal(state.tasks.length, 1); assert.equal(state.tasks[0].status, 'open'); assert.equal(state.station.foodPercent, 92);
    state = (await f.request('/station', { scenario: 'offline' })).data; assert.equal(state.station.online, false);
    assert.equal((await f.request('/reset', {})).status, 400);
    state = (await f.request('/reset', { confirm: 'reset-fictional-exercise' })).data; assert.equal(state.cats.length, 14); assert.equal(state.tasks.length, 0);
    for (const [key, records] of Object.entries(original)) assert.deepEqual(f.context.store.list(key), records);
  } finally { await f.close(); }
});

test('the reviewed exercise survives a fresh server instance and is disabled outside demo mode', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'care-exercise-')), path = join(dir, 'review.sqlite'); let f;
  try {
    f = await fixture({ dbPath: path }); await f.request('/import', {});
    await f.request('/updates/morning-02/review', review('existing', { catId: 'example-cat-1', alias: 'Stripey' }));
    await f.close(); f = await fixture({ dbPath: path }); const state = (await f.request()).data;
    assert.equal(state.updates.length, 6); assert.deepEqual(state.cats[0].aliases, ['Stripey']);
    await f.close(); f = await fixture({ dbPath: path, demoMode: false }); assert.equal((await f.request()).status, 403);
  } finally { if (f) await f.close(); rmSync(dir, { recursive: true }); }
});

test('report validation rejects impossible and reversed dates; baseline confirmations are not dated procedures', () => {
  const state = initialCareDemo(), report = careReport(state, today(), today());
  assert.equal(report.current.confirmedTnvr, 11); assert.equal(report.period.procedures, 0);
  assert.throws(() => careReport(state, '2026-02-31', today())); assert.throws(() => careReport(state, '2026-12-10', '2026-12-01'));
});

test('thermal scenarios persist matching temperatures and distinct care tasks through recovery and reporting', async () => {
  const f = await fixture();
  try {
    for (const [scenario, value, severity] of [['hot', 36, 'urgent'], ['cold', 5, 'warning'], ['freezing', -2, 'urgent'], ['hot', 36, 'urgent']]) {
      const result = await f.request('/station', { scenario });
      assert.equal(result.status, 200); assert.equal(result.data.station.temperatureC, value);
      const tasks = result.data.tasks.filter(task => task.type === `temperature-${scenario}`);
      assert.equal(tasks.length, 1); assert.equal(tasks[0].severity, severity);
      const evidence = result.data.events.find(item => item.id === tasks[0].evidenceId);
      assert.equal(evidence.reading.temperatureC, value);
    }
    const state = (await f.request('/station', { scenario: 'calm' })).data;
    assert.equal(state.station.temperatureC, 26); assert.equal(state.tasks.filter(task => task.status === 'open').length, 3);
    const report = await f.request(`/report.csv?from=${today()}&to=${today()}`);
    assert.match(report.data, /AMBIENT TEMPERATURE C/); assert.match(report.data, /Arduino exercise: freezing/);
    assert.ok(state.events.some(item => item.reading?.temperatureC === -2));
  } finally { await f.close(); }
});

test('existing rescue exercises retain reviews and migrate absent temperature to unknown', async () => {
  const f = await fixture();
  try {
    await f.request('/import', {});
    await f.request('/updates/morning-02/review', review('existing', { catId: 'example-cat-1', alias: 'Stripey' }));
    const state = (await f.request()).data; state.version = 1; delete state.station.temperatureC;
    state.readings.push({ id: 'legacy-sample', foodPercent: 72 }); f.context.store.put('care_demo', state);
    const migrated = (await f.request()).data;
    assert.equal(migrated.version, 3); assert.equal(migrated.station.temperatureC, null); assert.equal(migrated.readings[0].temperatureC, null);
    assert.deepEqual(migrated.cats[0].aliases, ['Stripey']); assert.equal(migrated.updates[1].status, 'reviewed');
    assert.equal(migrated.createdAt, state.createdAt); assert.equal(migrated.events.length, state.events.length);
  } finally { await f.close(); }
});
