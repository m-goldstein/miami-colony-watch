import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { supplyEstimate } from '../public/colony-planning.js';
import { createWeatherService } from '../server/weather.js';
import { createApp } from '../server/app.js';

test('packing estimates use entered portions, retain unknown inputs and never produce a negative shortfall', () => {
  assert.deepEqual(supplyEstimate(14, 3, 60, 1), { totalKg: 2.52, gapKg: 1.52 });
  assert.deepEqual(supplyEstimate(14, 3, 60, 3), { totalKg: 2.52, gapKg: 0 });
  assert.equal(supplyEstimate(14, 0, 60, 0), null);
  assert.equal(supplyEstimate(NaN, 3, 60, 0), null);
  assert.equal(supplyEstimate(1.5, 3, 60, 0), null);
  assert.equal(supplyEstimate(14, 3, 60, -1), null);
});

test('NWS forecast follows the point endpoint, caches concurrent requests and keeps missing rain and alerts unknown', async () => {
  let time = Date.now(), calls = 0;
  const service = createWeatherService(async url => {
    calls++;
    if (url.includes('/points/')) return Response.json({ properties: { forecast: 'https://api.weather.gov/gridpoints/MFL/1,2/forecast' } });
    if (url.includes('/alerts/')) throw new Error('Alert feed unavailable');
    return Response.json({ properties: { updateTime: new Date(time).toISOString(), periods: [{ name: 'Tonight', startTime: new Date(time).toISOString(),
      endTime: new Date(time + 3600000).toISOString(), temperature: 78, temperatureUnit: 'F', windSpeed: '10 mph', shortForecast: 'Showers', probabilityOfPrecipitation: { value: null } }] } });
  }, () => time);
  const [a, b] = await Promise.all([service(), service()]);
  assert.deepEqual(a, b); assert.equal(calls, 3); assert.equal(a.alertsAvailable, false); assert.equal(a.periods[0].rainChance, null);
  await service(); assert.equal(calls, 3);
  time += 600001; await service(); assert.equal(calls, 6);
});

test('a failed NWS refresh is retryable and does not become a forecast or an all-clear', async () => {
  let calls = 0;
  const service = createWeatherService(async () => { calls++; return new Response('', { status: 503 }); });
  await assert.rejects(service(), /unavailable/); await assert.rejects(service(), /unavailable/); assert.equal(calls, 2);
});

test('care plans persist with their colony without changing sensor evidence, visits or census', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'colony-plan-')), dbPath = join(directory, 'state.sqlite');
  let context = createApp({ dbPath, demoMode: true }), server;
  try {
    server = await new Promise(resolve => { const s = context.app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const before = await (await fetch(base + '/api/state')).json(), colony = before.colonies.find(c => c.name === 'South Point Park');
    assert.ok(colony?.demo);
    const input = { checklist: { backup: true, supplies: true, shelter: false, access: false, records: true }, lead: 'Elena', backup: 'Marco',
      checkIn: 'Tomorrow, 8 am if access is safe', notes: 'Collect sealed supplies before the visit.', cats: 14, days: 3, grams: 60, onHandKg: 2 };
    const endpoint = `${base}/api/colonies/${colony.id}/preparedness`;
    const patch = body => fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await patch({ ...input, days: -1 })).status, 400);
    assert.equal((await patch({ ...input, checklist: { backup: 'yes' } })).status, 400);
    assert.equal((await patch(input)).status, 200);
    const after = await (await fetch(base + '/api/state')).json();
    assert.equal(after.colonies.find(c => c.id === colony.id).preparedness.backup, 'Marco');
    assert.deepEqual(after.devices, before.devices); assert.deepEqual(after.cats, before.cats); assert.deepEqual(after.visits, before.visits);
    await new Promise(resolve => server.close(resolve)); server = null; context.store.close(); context = createApp({ dbPath, demoMode: true });
    assert.equal(context.store.get('colonies', colony.id).preparedness.notes, input.notes);
  } finally { if (server) await new Promise(resolve => server.close(resolve)); context.store.close(); rmSync(directory, { recursive: true }); }
});

test('the outlook endpoint reports upstream failure explicitly', async () => {
  const context = createApp({ dbPath: ':memory:', weatherService: async () => { throw new Error('upstream'); } });
  const server = await new Promise(resolve => { const s = context.app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/weather/south-point`);
    assert.equal(response.status, 503); assert.match((await response.json()).error, /could not be refreshed/);
  } finally { await new Promise(resolve => server.close(resolve)); context.store.close(); }
});
