import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCondition } from '../public/colony-map.js';
const now = Date.parse('2026-11-07T12:00:00Z');
const record = (patch = {}) => ({ device: { lifecycle: 'deployed', online: true, lastSeenAt: new Date(now - 20000).toISOString(),
  calibration: { foodLowPercent: 25, waterAlertPercent: 60 }, measurements: { fresh: true, sampledAt: new Date(now - 20000).toISOString(), foodPercent: 18, waterPercent: 3, wet: false }, ...patch } });
test('map summaries use saved station freshness and never turn stale or missing food into an empty hopper', () => {
  assert.equal(mapCondition(record(), now).low, true);
  for (const colony of [record({ online: false }), record({ lastSeenAt: new Date(now - 121000).toISOString() }), record({ lifecycle: 'maintenance' }), {}]) {
    const result = mapCondition(colony, now);
    assert.equal(result.fresh, false); assert.equal(result.food, null); assert.equal(result.low, false); assert.equal(result.state, 'offline');
  }
  const colony = record(); colony.device.measurements.foodPercent = null;
  const unknown = mapCondition(colony, now);
  assert.equal(unknown.state, 'check'); assert.equal(unknown.low, false); assert.match(unknown.note, /estimate unknown/);
});
test('map priorities use the linked station calibration and expire as time passes without a new snapshot', () => {
  const colony = record();
  colony.device.calibration.foodLowPercent = 10;
  assert.equal(mapCondition(colony, now).low, false);
  colony.device.measurements.waterPercent = 70;
  const wet = mapCondition(colony, now);
  assert.equal(wet.standing, true); assert.match(wet.note, /when access is safe/);
  const stale = mapCondition(colony, now + 121000);
  assert.equal(stale.standing, false); assert.equal(stale.rain, null); assert.equal(stale.state, 'offline');
});
