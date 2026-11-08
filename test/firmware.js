import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { DEFAULT_CALIBRATION } from '../server/domain.js';
import { frameToPacket } from '../gateway/protocol.js';
import { deliverPacket } from '../gateway/outbox.js';
import { parseSerialLine } from '../public/serial-protocol.js';
const temp = mkdtempSync(join(tmpdir(), 'colony-firmware-'));
let context, server;
try {
  const binary = join(temp, 'firmware-check');
  const compile = spawnSync('g++', ['-std=c++11', '-Wall', '-Wextra', '-Werror', '-I', 'test/firmware', 'test/firmware/check.cpp', '-o', binary], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr || 'g++ is required for the host firmware checks');
  const run = spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const frames = run.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(frames.length, 5); assert.equal(frames[0].sonarDistanceCm, 20); assert.equal(frames[1].sonarDistanceCm, null);
  assert.deepEqual(frames.map(f => f.temperatureC), [26, null, 36, 5, -2]);
  assert.equal(parseSerialLine(JSON.stringify(frames[0])).data.foodPercent, 40);
  assert.equal(parseSerialLine(JSON.stringify(frames[1])).data.foodPercent, null);
  context = createApp({ dbPath: ':memory:', demoMode: false });
  server = await new Promise(resolve => { const s = context.app.listen(0, '127.0.0.1', () => resolve(s)); });
  const apiUrl = `http://127.0.0.1:${server.address().port}`;
  async function post(path, body) { const r = await fetch(apiUrl + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); }
  const colony = await post('/api/colonies', { name: 'Firmware test colony', neighborhood: 'Fictional bench', caretaker: 'Test operator' });
  const provisioned = await post('/api/devices', { colonyId: colony.id, name: 'Firmware test station', lifecycle: 'deployed',
    calibration: DEFAULT_CALIBRATION, sitePermission: true, benchPassed: true, weatherProtected: true });
  for (let i = 0; i < frames.length; i++) {
    const packet = frameToPacket(frames[i], { deviceId: provisioned.device.id, bootId: 'host-firmware-test', receivedAt: new Date(Date.now() + i).toISOString() });
    const ack = await deliverPacket({ apiUrl, deviceKey: provisioned.deviceKey, packet });
    assert.equal(ack.accepted, true);
    const s = await (await fetch(apiUrl + '/api/state')).json();
    assert.equal(s.devices[0].measurements.foodPercent, i === 0 ? 40 : null);
    assert.equal(s.devices[0].measurements.temperatureC, frames[i].temperatureC);
    if (i >= 2) assert.ok(s.tasks.some(t => t.type === ['temperature-hot', 'temperature-cold', 'temperature-freezing'][i - 2]));
  }
  console.log('PASS: host firmware sonar/rotation/display/ACK and DHT11 sampling/LED/fault/recovery checks → actual JSON → gateway → authenticated API → SQLite → temperature readings and heat/cold/freezing tasks. Physical sensors are mocked.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (context) context.store.close();
  rmSync(temp, { recursive: true, force: true });
}
