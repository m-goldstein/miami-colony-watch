import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { estimateBuild, money, PRESETS } from '../public/manufacturing-model.js';

const context = createApp({ dbPath: ':memory:', demoMode: true });
const server = await new Promise(resolve => { const s = context.app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const cache = join(homedir(), '.cache/ms-playwright');
const cached = existsSync(cache) ? readdirSync(cache).filter(p => /^chromium-\d+$/.test(p)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])).map(p => join(cache, p, 'chrome-linux64/chrome')).find(existsSync) : null;
const executablePath = process.env.BROWSER_PATH || (existsSync(chromium.executablePath()) ? undefined : cached);
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('#concept-clock').filter({ hasText: 'fictional run' }).waitFor();
  // Initial state polling runs the pre-existing physical sensor alert evaluator.
  const physical = Object.fromEntries(['devices', 'cats', 'tasks', 'visits'].map(table => [table, context.store.list(table)]));
  const action = async run => {
    const [response] = await Promise.all([page.waitForResponse(r => r.url() === `${base}/api/care-demo/concept` && r.request().method() === 'POST'), run()]);
    assert.equal(response.status(), 200); await page.locator('#concept-status').filter({ hasText: 'Concept event saved' }).waitFor();
  };
  await action(() => page.locator('#concept-read').click()); await action(() => page.locator('#concept-read').click());
  assert.equal(await page.locator('#concept-unique').innerText(), '1'); assert.equal(await page.locator('#concept-sessions').innerText(), '1'); assert.equal(await page.locator('#concept-reads').innerText(), '2');
  await action(() => page.locator('#concept-return').click()); assert.equal(await page.locator('#concept-sessions').innerText(), '2');
  await page.locator('#concept-tag').selectOption('unlinked'); await action(() => page.locator('#concept-read').click());
  await page.locator('#concept-link-panel summary').click(); await page.locator('#concept-link-cat').selectOption('example-cat-14');
  await action(() => page.locator('#concept-link-form button').click());
  assert.equal(await page.locator('#concept-unique').innerText(), '2'); assert.equal(await page.locator('#rescue-cat-count').innerText(), '14');
  await action(() => page.locator('#concept-dispense').click()); assert.match(await page.locator('#concept-last-portion').innerText(), /10 g requested.*unverified/);
  await action(() => page.locator('#concept-jam').click()); assert.equal(await page.locator('#concept-dispense').isDisabled(), true);
  await action(() => page.locator('#concept-inspect').click()); await action(() => page.locator('#concept-advance').click());
  await action(() => page.locator('#concept-dispense').click()); assert.match(await page.locator('#concept-cycle-count').innerText(), /^2 /);
  await action(() => page.locator('#concept-hub-online').uncheck()); await action(() => page.locator('#concept-radio').selectOption('lora'));
  assert.match(await page.locator('#concept-hub-status').innerText(), /offline/); assert.equal(await page.locator('#concept-queue').innerText(), '6');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#concept-queue').filter({ hasText: '6' }).waitFor(); assert.equal(await page.locator('#concept-radio').inputValue(), 'lora');
  await action(() => page.locator('#concept-hub-online').check()); await action(() => page.locator('#concept-sync').click());
  assert.equal(await page.locator('#concept-queue').innerText(), '0'); assert.equal(await page.locator('#concept-acked').innerText(), '6');
  await action(() => page.locator('#concept-replay').click()); assert.equal(await page.locator('#concept-acked').innerText(), '6');
  for (const [table, records] of Object.entries(physical)) assert.deepEqual(context.store.list(table), records);
  mkdirSync('test-results', { recursive: true });
  await page.locator('#future-station').screenshot({ path: 'test-results/edge-concept-desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#future-station').screenshot({ path: 'test-results/edge-concept-mobile.png', animations: 'disabled' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'care desk must fit mobile viewport');

  await page.setViewportSize({ width: 1440, height: 1080 }); await page.goto(`${base}/manufacturing.html`, { waitUntil: 'networkidle' });
  await page.locator('#estimate-unit').filter({ hasText: '$175.12' }).waitFor();
  for (const figure of await page.locator('main img').all()) {
    await figure.scrollIntoViewIfNeeded(); await figure.evaluate(img => img.decode());
    assert.ok(await figure.evaluate(img => img.complete && img.naturalWidth > 0), `diagram loads: ${await figure.getAttribute('src')}`);
  }
  await page.locator('[data-board-part=rfid]').click(); assert.match(await page.locator('#part-description').innerText(), /caregiver associates/);
  await page.locator('[data-preset=sense]').click(); assert.equal(await page.locator('#estimate-unit').innerText(), money(estimateBuild(PRESETS.sense).unitTotal));
  await page.locator('[data-preset=network]').click(); assert.equal(await page.locator('#estimate-unit').innerText(), '$185.22');
  await page.locator('#build-quantity').fill('11'); assert.match(await page.locator('#estimate-hubs').innerText(), /2 new shared/);
  await page.locator('input[name=existingHub]').check(); assert.match(await page.locator('#estimate-hubs').innerText(), /already-owned/);
  await page.locator('#build-quantity').fill('0'); assert.equal(await page.locator('#download-bom').isDisabled(), true); assert.equal(await page.locator('#estimate-unit').innerText(), '—');
  await page.locator('#build-quantity').fill('11');
  const expected = estimateBuild({ ...PRESETS.network, quantity: 11, existingHub: true });
  assert.equal(await page.locator('#estimate-unit').innerText(), money(expected.unitTotal));
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('#build-quantity').inputValue(), '11');
  assert.equal(await page.locator('#estimate-unit').innerText(), money(expected.unitTotal));
  let downloading = page.waitForEvent('download'); await page.locator('#download-bom').click(); let download = await downloading;
  await download.saveAs('test-results/manufacturing-bom.csv'); const csv = readFileSync('test-results/manufacturing-bom.csv', 'utf8');
  assert.match(csv, /COMPLETE TOTAL/); assert.match(csv, /Engineering allowance/); assert.match(csv, /priority1design/); assert.ok(csv.includes(String(expected.batchTotal)));
  downloading = page.waitForEvent('download'); await page.locator('#download-brief').click(); download = await downloading;
  await download.saveAs('test-results/manufacturing-build-brief.json'); const brief = JSON.parse(readFileSync('test-results/manufacturing-build-brief.json', 'utf8'));
  assert.equal(brief.config.quantity, 11); assert.equal(brief.hubCount, 0); assert.equal(brief.batchTotal, expected.batchTotal); assert.equal(brief.artifacts.length, 4);
  await page.locator('[data-radio-view=lora]').click(); assert.match(await page.locator('#radio-description').innerText(), /not a LoRaWAN concentrator/);
  assert.equal(await page.locator('#source-list li').count(), 13);
  await page.locator('#reset-build').click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'test-results/manufacturing-desktop.png', fullPage: true, animations: 'disabled' });
  await page.locator('.board-large').screenshot({ path: 'test-results/manufacturing-pcb.png' });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `manufacturing page must fit ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'test-results/manufacturing-mobile.png', fullPage: true, animations: 'disabled' });
  await page.emulateMedia({ media: 'print' }); await page.pdf({ path: 'test-results/manufacturing-print.pdf', format: 'A4', printBackground: true });
  assert.deepEqual(errors, []);
  console.log('Hardware concept browser checks passed: visits, human association, gate faults, queue/replay, isolation, calculator, persistence, BOM/brief exports, four diagrams, print and responsive widths.');
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); context.store.close(); }
