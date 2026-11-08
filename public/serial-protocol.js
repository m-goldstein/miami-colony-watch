// Shared by the direct USB interface and its Node/browser tests. No DOM required.
import { validTemperature } from './temperature.js';
const uint32 = value => Number.isInteger(value) && value >= 0 && value <= 4294967295;
function bounded(value, min, max, integer = false) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
}
export function parseSerialLine(line) {
  const data = JSON.parse(line);
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Expected a JSON object');
  if (typeof data.event === 'string') {
    if (!['boot', 'hello', 'stream', 'error'].includes(data.event)) throw new Error('Unknown firmware event');
    if (data.event === 'boot' || data.event === 'hello') {
      if (typeof data.firmware !== 'string' || data.firmware.length > 80) throw new Error('Invalid firmware version');
    }
    if (data.event === 'hello' && (data.protocolVersion !== 1 || !bounded(data.telemetryIntervalMs, 250, 60000, true))) throw new Error('Unsupported serial protocol');
    if (data.event === 'stream' && !bounded(data.intervalMs, 250, 60000, true)) throw new Error('Invalid stream interval');
    if (data.event === 'error' && (typeof data.message !== 'string' || data.message.length > 160)) throw new Error('Invalid firmware error');
    return { type: 'event', data };
  }
  if (data.schemaVersion !== 1 || !uint32(data.sequence) || !uint32(data.uptimeMs)) throw new Error('Invalid telemetry identity');
  if (!bounded(data.sonarValidSamples, 0, 5, true)) throw new Error('Invalid echo count');
  if (data.sonarDistanceCm !== null && !bounded(data.sonarDistanceCm, 2, 400)) throw new Error('Invalid sonar distance');
  if ((data.sonarDistanceCm === null) !== (data.sonarValidSamples < 3)) throw new Error('Sonar needs three valid echoes, otherwise distance must be null');
  for (const key of ['rainAnalog', 'waterAnalog']) if (!bounded(data[key], 0, 1023, true)) throw new Error(`Invalid ${key}`);
  if (data.rainDigital !== 0 && data.rainDigital !== 1) throw new Error('Invalid rain digital state');
  for (const key of ['foodPercent', 'waterIndex']) {
    if (data[key] !== undefined && data[key] !== null && !bounded(data[key], 0, 100, true)) throw new Error(`Invalid ${key}`);
  }
  if (data.sonarDistanceCm === null && data.foodPercent !== undefined && data.foodPercent !== null) throw new Error('Unknown sonar cannot give a food estimate');
  for (const key of ['buttonPressed', 'rainWet']) if (data[key] !== undefined && typeof data[key] !== 'boolean') throw new Error(`Invalid ${key}`);
  if (data.temperatureC != null && !validTemperature(data.temperatureC)) throw new Error('Invalid temperatureC');
  if (data.screen !== undefined && !bounded(data.screen, 0, 4, true)) throw new Error('Invalid display screen');
  if (data.encoderPosition !== undefined && !bounded(data.encoderPosition, -2147483648, 2147483647, true)) throw new Error('Invalid encoder position');
  return { type: 'reading', data };
}

export class SerialLineDecoder {
  constructor(onLine, onError, maxLength = 2048) {
    this.onLine = onLine; this.onError = onError; this.maxLength = maxLength;
    this.decoder = new TextDecoder(); this.partial = ''; this.dropping = false;
  }
  push(bytes) {
    const text = this.decoder.decode(bytes, { stream: true });
    for (const c of text) {
      if (c === '\n') {
        const line = this.partial.trim(); this.partial = '';
        if (!this.dropping && line) this.onLine(line);
        this.dropping = false;
      } else if (!this.dropping) {
        if (this.partial.length >= this.maxLength) {
          this.partial = ''; this.dropping = true;
          this.onError(new Error('Serial frame exceeded 2048 characters; discarded until newline'));
        } else this.partial += c;
      }
    }
  }
}

export function workspacePacket(reading, deviceId, bootId, sampledAt) {
  const packet = { deviceId, bootId, sampledAt };
  for (const key of ['schemaVersion', 'sequence', 'uptimeMs', 'sonarDistanceCm', 'sonarValidSamples', 'rainAnalog', 'rainDigital', 'waterAnalog', 'temperatureC']) packet[key] = reading[key];
  return packet;
}
