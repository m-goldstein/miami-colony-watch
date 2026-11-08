import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateBuild, compareScale, PRESETS } from '../public/manufacturing-model.js';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} should equal ${b}`);
const price = (estimate, key) => estimate.lines.find(line => line.key === key)?.unit;

test('manufacturing estimate reconciles the entire station and batch, separately from controller PCBA', () => {
  const e = estimateBuild(PRESETS.care);
  close(e.boardUnit, 21.541); close(e.unitTotal, 175.19615); close(e.batchTotal, 17519.615);
  close(e.lines.reduce((sum, line) => sum + line.extended, 0), e.partsUnit * 100);
  close(e.groups.reduce((sum, group) => sum + group.amount, 0), e.unitTotal);
  close(e.batchTotal, (e.partsUnit * 100 + 65 + 40 + 350) * 1.15 + 1500);
  assert.equal(e.hubCount, 10); assert.ok(e.unitTotal > e.boardUnit * 5);
  assert.match(e.exclusion, /regulatory testing/);
});

test('only published volume breaks change component prices; five-board minimum stays visible', () => {
  const at = quantity => estimateBuild({ ...PRESETS.care, quantity });
  const one = at(1), five = at(5), ten = at(10), hundred = at(100), thousand = at(1000);
  assert.equal(price(one, 'climate'), 2.15); assert.equal(price(five, 'climate'), 1.906); assert.equal(price(ten, 'climate'), 1.816);
  assert.equal(price(hundred, 'climate'), 1.571); assert.equal(price(thousand, 'climate'), 1.38772);
  assert.equal(price(one, 'servo'), 14.95); assert.equal(price(ten, 'servo'), 13.46); assert.equal(price(hundred, 'servo'), 11.96);
  assert.equal(price(one, 'pcb'), 7.5); assert.equal(price(five, 'pcb'), 1.5);
  assert.equal(price(one, 'reader'), price(thousand, 'reader')); assert.equal(price(one, 'sonar'), price(thousand, 'sonar'));
  assert.equal(price(hundred, 'mcu'), price(thousand, 'mcu'));
});

test('the default starts with sensing and scale comparisons retain assumptions and whole hubs', () => {
  const lean = estimateBuild({});
  close(lean.unitTotal, 84.96715); assert.equal(lean.config.rfid, false); assert.equal(lean.config.dispenser, false); assert.equal(lean.config.radio, 'wifi');
  const scales = compareScale({ ...PRESETS.network, stationsPerHub: 7, development: 2400 });
  assert.deepEqual(scales.map(e => e.hubCount), [2, 15, 143]);
  assert.deepEqual(scales.map(e => e.developmentPerUnit), [240, 24, 2.4]);
  for (const e of scales) { assert.equal(price(e, 'reader'), 45); close(price(e, 'reel') * e.config.quantity, 7); }
  assert.equal(compareScale({ quantity: 0 }), null);
});

test('modularity removes real costs and hubs round up without double-charging built-in BLE or Wi-Fi', () => {
  const sense = estimateBuild(PRESETS.sense), care = estimateBuild(PRESETS.care), lora = estimateBuild({ ...PRESETS.network, quantity: 11 });
  assert.equal(sense.hubCount, 0); assert.equal(price(sense, 'servo'), undefined); assert.equal(price(sense, 'reader'), undefined);
  assert.equal(price(sense, 'mcu'), price(care, 'mcu')); close(care.partsUnit - sense.partsUnit, 51 + 11.96 + 12);
  assert.equal(lora.hubCount, 2); assert.equal(lora.hubTotal, 120); assert.equal(price(lora, 'lora'), 4.29);
  const owned = estimateBuild({ ...lora.config, existingHub: true });
  assert.equal(owned.hubTotal, 0); assert.equal(owned.hubCount, 0); close(lora.batchTotal - owned.batchTotal, 120 * 1.15);
  const bench = estimateBuild({ ...sense.config, outdoorSonar: false }); close(sense.partsUnit - bench.partsUnit, 12.4);
});

test('invalid inputs cannot become cheap-looking zero or NaN estimates', () => {
  for (const config of [{ quantity: 0 }, { quantity: 1.5 }, { quantity: 10001 }, { quantity: '100' }, { stationsPerHub: 0 },
    { radio: '5g' }, { rfid: 'false' }, { development: -1 }, { freight: NaN }, { setup: Infinity }, { contingency: 101 }]) assert.equal(estimateBuild(config), null);
  const e = estimateBuild({ setup: 0, development: 0, freight: 0, contingency: 0, existingHub: true });
  close(e.unitTotal, e.partsUnit); close(e.batchTotal, e.partsUnit * 100);
});
