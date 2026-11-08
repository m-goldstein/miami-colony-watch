import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { DEFAULT_CALIBRATION, deviceView, measurements, validateReading } from '../server/domain.js';
import { frameToPacket } from '../gateway/protocol.js';
import { parseSerialLine, workspacePacket } from '../public/serial-protocol.js';
import { temperatureState, temperatureLabel } from '../public/temperature.js';
import { careState, demoReading } from '../public/colony-demo.js';
import { mapCondition } from '../public/colony-map.js';

const frame = { schemaVersion: 1, sequence: 0, uptimeMs: 1000, sonarDistanceCm: 10, sonarValidSamples: 5,
  rainAnalog: 900, rainDigital: 1, waterAnalog: 100, temperatureC: 26 };
const packet = extra => ({ ...frame, deviceId: 'test', bootId: 'test-boot', sampledAt: new Date().toISOString(), ...extra });

test('ambient thresholds include boundary temperatures and preserve zero, negatives, and unknowns', () => {
  for (const [value, state] of [[-20, 'freezing'], [-0.1, 'freezing'], [0, 'freezing'], [0.1, 'cold'], [7, 'cold'], [7.1, 'normal'], [31.9, 'normal'], [32, 'hot'], [60, 'hot'],
    [undefined, 'unknown'], [null, 'unknown'], [NaN, 'unknown'], [Infinity, 'unknown'], [-127, 'unknown'], ['32', 'unknown']]) {
    assert.equal(temperatureState(value), state);
  }
  assert.equal(temperatureLabel(0), '0.0°C / 32.0°F');
  assert.equal(temperatureLabel(-2), '-2.0°C / 28.4°F');
  assert.equal(temperatureLabel(null), 'Unknown');
});

test('USB and gateway accept legacy frames but reject malformed thermometer data; both save temperature', () => {
  for (const temperatureC of [-20, -2.3, 0, 32, 60, null]) {
    const f = parseSerialLine(JSON.stringify({ ...frame, temperatureC, screen: 4 })).data;
    const saved = workspacePacket(f, 'test', 'test-boot', new Date().toISOString());
    assert.equal(validateReading(saved).temperatureC, temperatureC);
    assert.equal(frameToPacket(f, { deviceId: 'test', bootId: 'test-boot' }).temperatureC, temperatureC);
  }
  const { temperatureC, ...legacy } = frame;
  assert.equal(parseSerialLine(JSON.stringify(legacy)).type, 'reading');
  assert.equal(validateReading(packet({ temperatureC: undefined })).temperatureC, null);
  for (const value of [-127, -20.1, 60.1, '32', false, {}, NaN, Infinity]) {
    assert.throws(() => validateReading(packet({ temperatureC: value })), /temperatureC/);
    if (Number.isFinite(value) || typeof value !== 'number') assert.throws(() => parseSerialLine(JSON.stringify({ ...frame, temperatureC: value })), /temperatureC/);
  }
});

test('stale and disconnected station readings clear temperature and cannot show a thermal all-clear', () => {
  const stale = packet({ sampledAt: new Date(Date.now() - 6 * 60000).toISOString(), temperatureC: 36 });
  assert.equal(measurements(stale, DEFAULT_CALIBRATION).temperatureC, null);
  assert.equal(measurements(stale, DEFAULT_CALIBRATION).temperatureStatus, 'unknown');
  const device = { lifecycle: 'deployed', lastSeenAt: new Date(Date.now() - 121000).toISOString(), calibration: DEFAULT_CALIBRATION };
  assert.equal(deviceView(device, packet()).measurements.temperatureC, null);
  assert.equal(measurements(null, DEFAULT_CALIBRATION).temperatureC, null);
  assert.equal(careState({ ...demoReading('calm'), temperatureC: null }, true).kind, 'temperature-unknown');
  assert.equal(careState(demoReading('hot'), false).kind, 'offline');
  assert.equal(careState({ ...demoReading('water'), temperatureC: -2 }, true).kind, 'freezing');
  const now = Date.now(), colony = { device: { ...device, online: true, lastSeenAt: new Date(now).toISOString(), measurements: measurements(packet({ temperatureC: 36 }), DEFAULT_CALIBRATION) } };
  assert.equal(mapCondition(colony, now).temperatureRisk, true);
  assert.equal(mapCondition(colony, now + 121000).temperatureC, null);
  assert.equal(mapCondition(colony, now + 121000).temperatureRisk, false);
});

test('authenticated readings persist temperatures, deduplicate thermal tasks, and do not alert on old hot backlog', async () => {
  const context = createApp({ dbPath: ':memory:', demoMode: false });
  const server = await new Promise(resolve => { const s = context.app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function post(path, body, key) {
    const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  }
  try {
    const colony = (await post('/api/colonies', { name: 'Thermometer bench', neighborhood: 'Fictional', caretaker: 'Test' })).body;
    const { device, deviceKey } = (await post('/api/devices', { name: 'DHT11 station', colonyId: colony.id, lifecycle: 'deployed',
      calibration: DEFAULT_CALIBRATION, sitePermission: true, benchPassed: true, weatherProtected: true })).body;
    let sequence = 0;
    const send = extra => post('/api/readings', packet({ deviceId: device.id, sequence: sequence++, ...extra }), deviceKey);
    for (const temperatureC of [26, 0, -2, 5, 7, 32, 36, null, null]) {
      assert.equal((await send({ temperatureC })).status, 202);
      assert.equal(context.store.latest(device.id).temperatureC, temperatureC);
    }
    const tasks = context.store.list('tasks');
    assert.equal(tasks.filter(t => t.type === 'temperature-hot' && t.severity === 'urgent').length, 1);
    assert.equal(tasks.filter(t => t.type === 'temperature-freezing' && t.severity === 'urgent').length, 1);
    assert.equal(tasks.filter(t => t.type === 'temperature-cold' && t.severity === 'warning').length, 1);
    assert.equal(tasks.filter(t => t.type === 'temperature-unknown').length, 1);
    assert.equal((await send({ temperatureC: -127 })).status, 400);
    await send({ temperatureC: 26 });
    await send({ temperatureC: 50, sampledAt: new Date(Date.now() - 3600000).toISOString() });
    const state = await (await fetch(base + '/api/state')).json();
    assert.equal(state.devices[0].measurements.temperatureC, 26);
    assert.equal(state.devices[0].measurements.temperatureStatus, 'normal');
    assert.equal(state.tasks.filter(t => t.type === 'temperature-hot').length, 1);
    // A new normal reading does not silently complete caregiver checks.
    assert.equal(state.tasks.filter(t => t.type.startsWith('temperature-') && t.status === 'open').length, 4);
  } finally { await new Promise(resolve => server.close(resolve)); context.store.close(); }
});
