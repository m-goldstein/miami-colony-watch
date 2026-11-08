import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SerialLineDecoder, parseSerialLine, workspacePacket } from '../public/serial-protocol.js';
import { SerialConnection } from '../public/serial-connection.js';
const reading = { schemaVersion: 1, sequence: 0, uptimeMs: 1000, sonarDistanceCm: 20, sonarValidSamples: 5,
  rainAnalog: 900, rainDigital: 1, waterAnalog: 100, foodPercent: 40, waterIndex: 0, rainWet: false,
  encoderPosition: -3, buttonPressed: false, screen: 1 };
const encode = text => new TextEncoder().encode(text);
async function until(predicate) { for (let i = 0; i < 1000; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 2)); } throw new Error('Timed out'); }
class Port extends EventTarget {
  async open(options) {
    this.options = options; this.commands = []; this.closed = false;
    this.readable = new ReadableStream({ start: controller => { this.input = controller; } });
    this.writable = new WritableStream({ write: chunk => { this.commands.push(new TextDecoder().decode(chunk)); } });
  }
  async close() { assert.equal(this.readable.locked, false); assert.equal(this.writable.locked, false); this.closed = true; }
  emit(text) { this.input.enqueue(encode(text)); }
}
class Serial extends EventTarget {
  async requestPort() { this.port = new Port(); return this.port; }
}

test('serial protocol validates quality and raw ranges without inventing food on missing echoes', () => {
  assert.equal(parseSerialLine(JSON.stringify(reading)).data.foodPercent, 40);
  const missing = { ...reading, sequence: 1, sonarDistanceCm: null, sonarValidSamples: 0, foodPercent: null };
  assert.equal(parseSerialLine(JSON.stringify(missing)).data.foodPercent, null);
  for (const patch of [{ sonarDistanceCm: null }, { rainAnalog: 1024 }, { sequence: -1 }, { rainDigital: 2 },
    { foodPercent: 101 }, { screen: 4 }, { rainWet: 'false' }, { buttonPressed: 0 }, { sonarValidSamples: 2 }]) {
    assert.throws(() => parseSerialLine(JSON.stringify({ ...reading, ...patch })));
  }
  assert.throws(() => parseSerialLine('[]'));
  assert.throws(() => parseSerialLine('{"event":"error","message":{}}'));
  assert.throws(() => parseSerialLine('{"event":"hello","firmware":"test","protocolVersion":2,"telemetryIntervalMs":1000}'));
});
test('line framing handles split UTF-8, CRLF, multiple packets and oversize-line recovery', () => {
  const frames = [], errors = [];
  const decoder = new SerialLineDecoder(line => frames.push(JSON.parse(line)), error => errors.push(error));
  const bytes = encode('{"event":"error","message":"café"}\r\n' + JSON.stringify(reading) + '\n');
  for (const byte of bytes) decoder.push(new Uint8Array([byte]));
  assert.equal(frames[0].message, 'café'); assert.equal(frames[1].foodPercent, 40);
  decoder.push(encode('x'.repeat(5000))); assert.equal(decoder.partial.length, 0);
  decoder.push(encode('\n' + JSON.stringify(reading) + '\n'));
  assert.equal(errors.length, 1); assert.equal(frames.length, 3);
});
test('browser transport handshakes, reads fragmented frames, writes commands, releases locks and reconnects', async () => {
  const serial = new Serial(), frames = [], errors = [];
  const connection = new SerialConnection({ serial, onFrame: frame => frames.push(frame), onError: (error, kind) => errors.push({ error, kind }) });
  try {
    await connection.connect(); const port = serial.port;
    assert.equal(port.options.baudRate, 115200);
    port.emit('{"event":"boot","firmware":"colony-monitor/1.1"}\n');
    await until(() => port.commands.includes('SAMPLE\n'));
    assert.deepEqual(port.commands.slice(0, 3), ['HELLO\n', 'STREAM 1000\n', 'SAMPLE\n']);
    const line = JSON.stringify(reading); port.emit(line.slice(0, 13)); port.emit(line.slice(13) + '\n');
    await until(() => frames.some(frame => frame.type === 'reading'));
    port.emit('bad JSON\n' + JSON.stringify({ ...reading, sequence: 1 }) + '\n');
    await until(() => frames.filter(frame => frame.type === 'reading').length === 2);
    assert.equal(errors[0].kind, 'frame');
    await connection.setIntervalMs(500);
    await connection.send('B'); await connection.send('A');
    assert.ok(port.commands.includes('STREAM 500\n'));
    await assert.rejects(connection.send('ARBITRARY COMMAND'), /Unsupported/);
    await assert.rejects(connection.setIntervalMs(1), /250/);
    await connection.disconnect(); assert.equal(port.closed, true); assert.equal(connection.state, 'disconnected');
    await connection.connect(); assert.notEqual(serial.port, port);
  } finally { await connection.disconnect(); }
});
test('cancelled chooser is quiet; busy port and physical removal leave reconnectable state', async () => {
  const cancelled = new SerialConnection({ serial: { requestPort: async () => { throw new DOMException('Cancelled', 'NotFoundError'); } } });
  assert.equal(await cancelled.connect(), false); assert.equal(cancelled.state, 'disconnected');
  const busy = new SerialConnection({ serial: { requestPort: async () => ({ open: async () => { throw new Error('Port busy'); } }) } });
  await assert.rejects(busy.connect(), /Port busy/); assert.equal(busy.state, 'disconnected');
  const serial = new Serial(), connection = new SerialConnection({ serial });
  await connection.connect(); serial.port.input.error(new DOMException('Device removed', 'NetworkError'));
  await until(() => connection.state === 'disconnected'); assert.equal(serial.port.closed, true);
  await connection.connect(); await connection.disconnect();
});
test('workspace envelope preserves acquisition time, boot/session identity and null echoes', () => {
  const p = workspacePacket({ ...reading, sonarDistanceCm: null, sonarValidSamples: 0, foodPercent: null }, 'physical', 'boot-session', '2026-11-07T20:00:00.000Z');
  assert.equal(p.sonarDistanceCm, null); assert.equal(p.deviceId, 'physical'); assert.equal(p.bootId, 'boot-session');
  assert.equal(p.sampledAt, '2026-11-07T20:00:00.000Z'); assert.equal(p.foodPercent, undefined);
});
