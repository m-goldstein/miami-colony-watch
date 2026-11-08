import { createHash, randomUUID } from 'node:crypto';
export const id = prefix => `${prefix}-${randomUUID().slice(0, 8)}`;
export const hashKey = key => createHash('sha256').update(key).digest('hex');
export const DEFAULT_CALIBRATION = {
  foodEmptyCm: 30, foodFullCm: 5, foodLowPercent: 25,
  waterDryRaw: 100, waterWetRaw: 800, waterAlertPercent: 60,
  rainDryRaw: 900, rainWetRaw: 250, rainActiveLow: true
};
export function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
export function text(value, field, max = 200, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`Invalid ${field}`);
  return value.trim();
}
export function number(value, field, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`Invalid ${field}`);
  return value;
}
export function calibration(input) {
  if (!input || typeof input !== 'object') fail('Calibration is required');
  const result = {};
  for (const field of ['foodEmptyCm', 'foodFullCm']) result[field] = number(input[field], field, 2, 400);
  if (result.foodEmptyCm - result.foodFullCm < 2) fail('Empty headspace must be at least 2cm greater than full headspace');
  for (const field of ['waterDryRaw', 'waterWetRaw', 'rainDryRaw', 'rainWetRaw']) result[field] = number(input[field], field, 0, 1023, true);
  if (Math.abs(result.waterDryRaw - result.waterWetRaw) < 50 || Math.abs(result.rainDryRaw - result.rainWetRaw) < 50) fail('Wet and dry readings must differ by at least 50 ADC counts');
  for (const field of ['foodLowPercent', 'waterAlertPercent']) result[field] = number(input[field], field, 1, 99);
  if (typeof input.rainActiveLow !== 'boolean') fail('rainActiveLow must be a boolean');
  result.rainActiveLow = input.rainActiveLow;
  return result;
}
export function validateReading(body, now = Date.now()) {
  if (body.schemaVersion !== 1) fail('schemaVersion must be 1');
  const result = { schemaVersion: 1 };
  for (const field of ['deviceId', 'bootId']) result[field] = text(body[field], field, 80);
  result.sequence = number(body.sequence, 'sequence', 0, 4294967295, true);
  result.uptimeMs = number(body.uptimeMs, 'uptimeMs', 0, 4294967295, true);
  const time = Date.parse(body.sampledAt);
  if (!Number.isFinite(time) || time > now + 300000 || time < now - 7 * 86400000) fail('sampledAt must be within the past 7 days and no more than 5 minutes in the future');
  result.sampledAt = new Date(time).toISOString();
  result.sonarDistanceCm = body.sonarDistanceCm === null ? null : number(body.sonarDistanceCm, 'sonarDistanceCm', 2, 400);
  result.sonarValidSamples = number(body.sonarValidSamples, 'sonarValidSamples', 0, 5, true);
  if ((result.sonarDistanceCm === null) !== (result.sonarValidSamples < 3)) fail('A sonar estimate requires at least 3 valid samples; otherwise send null');
  result.rainAnalog = number(body.rainAnalog, 'rainAnalog', 0, 1023, true);
  result.rainDigital = number(body.rainDigital, 'rainDigital', 0, 1, true);
  result.waterAnalog = number(body.waterAnalog, 'waterAnalog', 0, 1023, true);
  return result;
}
const percent = (value, dry, wet) => Math.round(Math.max(0, Math.min(100, 100 * (value - dry) / (wet - dry))));
export function measurements(reading, config, now = Date.now()) {
  if (!reading) return { fresh: false, foodPercent: null, waterPercent: null, rainPercent: null, wet: null, sampledAt: null };
  const fresh = now - Date.parse(reading.sampledAt) <= 5 * 60000;
  return {
    fresh, sampledAt: reading.sampledAt, source: reading.source,
    foodPercent: fresh && reading.sonarDistanceCm !== null ? percent(reading.sonarDistanceCm, config.foodEmptyCm, config.foodFullCm) : null,
    waterPercent: fresh ? percent(reading.waterAnalog, config.waterDryRaw, config.waterWetRaw) : null,
    rainPercent: fresh ? percent(reading.rainAnalog, config.rainDryRaw, config.rainWetRaw) : null,
    wet: fresh ? reading.rainDigital === (config.rainActiveLow ? 0 : 1) : null,
    sonarDistanceCm: reading.sonarDistanceCm,
    sonarValidSamples: reading.sonarValidSamples,
    waterAnalog: reading.waterAnalog, rainAnalog: reading.rainAnalog, rainDigital: reading.rainDigital
  };
}
export function deviceView(device, reading, now = Date.now()) {
  const { keyHash, ...safe } = device;
  const online = device.lifecycle === 'deployed' && now - Date.parse(device.lastSeenAt || 0) < 120000;
  const m = measurements(reading, device.calibration, now);
  if (!online) Object.assign(m, { fresh: false, foodPercent: null, waterPercent: null, rainPercent: null, wet: null });
  return { ...safe, online, measurements: m };
}
export function ensureTask(store, device, type, title, severity, now = new Date().toISOString()) {
  const active = store.list('tasks').find(t => t.deviceId === device.id && t.type === type && t.status !== 'completed');
  if (active) return active;
  const recent = store.list('tasks').find(t => t.deviceId === device.id && t.type === type && Date.now() - Date.parse(t.updatedAt) < 30 * 60000);
  if (recent) return recent;
  return store.put('tasks', { id: id('task'), colonyId: device.colonyId, deviceId: device.id, type, title,
    severity, status: 'open', assignee: '', createdAt: now, updatedAt: now, origin: 'sensor' });
}
export function evaluateDevice(store, device, now = Date.now()) {
  if (device.lifecycle !== 'deployed') return;
  const view = deviceView(device, store.latest(device.id), now);
  if (!view.online) {
    ensureTask(store, device, 'offline', 'Check station connection', 'warning');
    return;
  }
  const m = view.measurements;
  if (!m.fresh) { ensureTask(store, device, 'stale', 'Check delayed sensor readings', 'warning'); return; }
  if (m.foodPercent === null) ensureTask(store, device, 'sonar', 'Inspect food sensor: estimate unavailable', 'warning');
  else if (m.foodPercent <= device.calibration.foodLowPercent) ensureTask(store, device, 'food', 'Refill food and inspect the hopper', 'urgent');
  if (m.waterPercent >= device.calibration.waterAlertPercent) ensureTask(store, device, 'water', 'Inspect standing water at the station', 'urgent');
  if (m.wet) ensureTask(store, device, 'rain', 'Check shelter and keep food dry', 'warning');
}
