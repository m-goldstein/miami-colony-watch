import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { DEFAULT_CALIBRATION } from '../server/domain.js';
async function until(predicate, timeout = 7000) {
  const started = Date.now();
  while (!predicate()) { if (Date.now() - started > timeout) throw new Error('Virtual serial flow timed out'); await new Promise(resolve => setTimeout(resolve, 40)); }
}
const canRun = process.platform === 'linux' && spawnSync('python3', ['--version']).status === 0;
test('real gateway serial driver queues during an API outage and replays successfully', { skip: !canRun, timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'colony-serial-'));
  const outbox = join(directory, 'outbox.jsonl');
  const context = createApp({ dbPath: ':memory:', demoMode: false });
  let apiOnline = true, gateway, python, log = '', serialLog = '';
  const server = createServer((req, res) => {
    if (!apiOnline && req.url === '/api/readings') { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"error":"test outage"}'); }
    else context.app(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const apiUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    async function post(path, body) { return (await fetch(apiUrl + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    const colony = await post('/api/colonies', { name: 'Serial test colony', neighborhood: 'Fictional bench', caretaker: 'Test operator' });
    const station = await post('/api/devices', { colonyId: colony.id, name: 'Serial test station', lifecycle: 'deployed', calibration: DEFAULT_CALIBRATION,
      sitePermission: true, benchPassed: true, weatherProtected: true });
    python = spawn('python3', ['-u', '-c', `import os, pty, sys, threading, tty
master, slave = pty.openpty()
tty.setraw(slave)
print(os.ttyname(slave), flush=True)
def writer():
    for line in sys.stdin:
        os.write(master, line.encode())
threading.Thread(target=writer, daemon=True).start()
while True:
    data = os.read(master, 4096)
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()
`], { stdio: ['pipe', 'pipe', 'pipe'] });
    python.stdout.on('data', chunk => { serialLog += chunk.toString(); });
    await until(() => serialLog.includes('\n'));
    const serialPath = serialLog.split('\n')[0].trim();
    gateway = spawn(process.execPath, ['gateway/index.js'], { cwd: process.cwd(), env: { ...process.env,
      DEVICE_ID: station.device.id, DEVICE_API_KEY: station.deviceKey, SERIAL_PORT: serialPath, SERIAL_BAUD: '115200', API_URL: apiUrl, GATEWAY_OUTBOX: outbox }, stdio: ['ignore', 'pipe', 'pipe'] });
    gateway.stdout.on('data', chunk => { log += chunk.toString(); }); gateway.stderr.on('data', chunk => { log += chunk.toString(); });
    await until(() => log.includes('Serial connected'));
    const frame = { schemaVersion: 1, sequence: 0, uptimeMs: 10000, sonarDistanceCm: 20, sonarValidSamples: 5, rainAnalog: 900, rainDigital: 1, waterAnalog: 100 };
    python.stdin.write(JSON.stringify(frame) + '\n');
    await until(() => context.store.latest(station.device.id)?.sonarDistanceCm === 20);
    await until(() => serialLog.includes('A\n'));
    apiOnline = false;
    python.stdin.write(JSON.stringify({ ...frame, sequence: 1, uptimeMs: 20000, sonarDistanceCm: 28 }) + '\n');
    await until(() => log.includes('HTTP 503'));
    assert.ok(existsSync(outbox)); assert.equal(readFileSync(outbox, 'utf8').trim().split('\n').length, 1);
    assert.equal(context.store.latest(station.device.id).sonarDistanceCm, 20);
    apiOnline = true;
    await until(() => context.store.latest(station.device.id)?.sonarDistanceCm === 28);
    await until(() => readFileSync(outbox, 'utf8') === '');
    assert.equal(context.store.history(station.device.id).length, 2);
    assert.ok(context.store.list('tasks').some(t => t.deviceId === station.device.id && t.type === 'food'));
    assert.ok(!log.includes(station.deviceKey));
  } finally {
    if (gateway && gateway.exitCode === null) { const done = new Promise(resolve => gateway.once('exit', resolve)); gateway.kill('SIGTERM'); await done; }
    if (python && python.exitCode === null) { const done = new Promise(resolve => python.once('exit', resolve)); python.kill('SIGTERM'); await done; }
    await new Promise(resolve => server.close(resolve)); context.store.close(); rmSync(directory, { recursive: true, force: true });
  }
});
