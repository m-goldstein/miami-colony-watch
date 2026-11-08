import { SerialPort, ReadlineParser } from 'serialport';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Outbox, deliverPacket } from './outbox.js';
import { frameToPacket } from './protocol.js';

const deviceId = process.env.DEVICE_ID, deviceKey = process.env.DEVICE_API_KEY, path = process.env.SERIAL_PORT;
if (!deviceId || !deviceKey || !path) throw new Error('Set DEVICE_ID, DEVICE_API_KEY, and SERIAL_PORT in .env. Provision the station in the dashboard first.');
const apiUrl = process.env.API_URL || 'http://127.0.0.1:3000';
const destination = new URL(apiUrl);
if (destination.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(destination.hostname)) throw new Error('Use HTTPS when forwarding beyond the local machine');
const outbox = new Outbox(resolve(process.env.GATEWAY_OUTBOX || 'gateway/outbox.jsonl'));
let port, sessionId = randomUUID(), previousSequence = -1, flushing = false, retryAt = 0, backoff = 1000, stopped = false;
console.log(`Gateway for ${deviceId}. ${outbox.items.length} queued readings. Credentials are never printed.`);

async function flush() {
  if (flushing || Date.now() < retryAt || stopped) return;
  flushing = true;
  try {
    let sent = 0;
    // Persist each acknowledgement: a crash can only cause an idempotent replay.
    while (outbox.items.length && sent < 20) {
      const packet = outbox.items[0];
      if (Date.now() - Date.parse(packet.sampledAt) > 7 * 86400000) {
        console.error('Oldest queued reading exceeds server retention. Archive the outbox before removing expired entries; delivery is paused.');
        retryAt = Date.now() + 60000; break;
      }
      await deliverPacket({ apiUrl, deviceKey, packet });
      outbox.acknowledge(1);
      if (port?.isOpen) port.write('A\n');
      sent++;
    }
    if (sent) console.log(`Acknowledged ${sent} readings; ${outbox.items.length} remain queued.`);
    backoff = 1000;
  } catch (error) {
    console.error(`${error.message}. Keeping readings on disk; retry in ${backoff / 1000}s.`);
    retryAt = Date.now() + backoff;
    backoff = Math.min(30000, backoff * 2);
  } finally { flushing = false; }
}
function connect() {
  if (stopped) return;
  port = new SerialPort({ path, baudRate: Number(process.env.SERIAL_BAUD || 115200), autoOpen: false });
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
  parser.on('data', line => {
    if (line.length > 2048) { console.error('Rejected oversized serial frame.'); return; }
    try {
      const frame = JSON.parse(line.trim());
      if (frame.schemaVersion !== 1) return; // Startup events are not measurements.
      if (frame.sequence < previousSequence) sessionId = randomUUID();
      previousSequence = frame.sequence;
      const packet = frameToPacket(frame, { deviceId, bootId: sessionId });
      outbox.append(packet);
      flush();
    } catch (error) { console.error(`Rejected serial frame: ${error.message}`); }
  });
  port.on('error', error => console.error(`Serial connection: ${error.message}`));
  port.on('open', () => { sessionId = randomUUID(); previousSequence = -1; console.log(`Serial connected on ${path}; waiting for measurements.`); });
  port.on('close', () => { if (!stopped) { console.error('Serial disconnected; reconnecting in 3 seconds.'); setTimeout(connect, 3000); } });
  port.open(error => { if (error && !stopped) setTimeout(connect, 3000); });
}
connect();
const timer = setInterval(flush, 1000);
function shutdown() { stopped = true; clearInterval(timer); if (port?.isOpen) port.close(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
