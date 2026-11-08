import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarios, demoReading, careState } from '../public/colony-demo.js';
import { parseSerialLine } from '../public/serial-protocol.js';
test('demo scenarios are valid, explicitly separate preview readings with predictable care priorities', () => {
  for (const [key, scenario] of Object.entries(scenarios)) {
    const reading = demoReading(key, 1);
    assert.equal(parseSerialLine(JSON.stringify(reading)).data.foodPercent, scenario.food);
    const care = careState(reading, scenario.online);
    assert.equal(care.kind, { calm: 'calm', food: 'food', refill: 'calm', rain: 'rain', water: 'water', offline: 'offline' }[key]);
  }
  assert.throws(() => demoReading('unrecognized'));
});
test('care priority keeps unknown readings distinct from empty food and cannot mark stale data settled', () => {
  const unknown = { ...demoReading('calm'), foodPercent: null, sonarDistanceCm: null, sonarValidSamples: 0 };
  assert.equal(careState(unknown, true).kind, 'unknown');
  assert.equal(careState(unknown, true).checks, 1);
  assert.equal(careState(demoReading('calm'), false).kind, 'offline');
  assert.equal(careState(null, false).kind, 'offline');
  const simultaneous = { ...demoReading('water'), foodPercent: 10 };
  assert.equal(careState(simultaneous, true).checks, 3);
  assert.equal(careState(simultaneous, true).kind, 'water');
});
