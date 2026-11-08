import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
const context = createApp({ dbPath: ':memory:', demoMode: true });
const server = await new Promise(resolve => { const s = context.app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const cache = join(homedir(), '.cache/ms-playwright');
const cached = existsSync(cache) ? readdirSync(cache).filter(p => /^chromium-\d+$/.test(p)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])).map(p => join(cache, p, 'chrome-linux64/chrome')).find(existsSync) : null;
const executablePath = process.env.BROWSER_PATH || (existsSync(chromium.executablePath()) ? undefined : cached);
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(base + '/colonies.html', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Every colony, on your radar.' }).waitFor();
  await page.locator('.pulse-panel tbody tr').first().waitFor();
  assert.equal(await page.locator('.pulse-panel tbody tr').count(), 6);
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth), true);
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });

  await page.getByRole('button', { name: /Try a sensor scenario/ }).click();
  await page.locator('.modal select').nth(1).selectOption('no-echo');
  await page.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await page.locator('.modal').waitFor({ state: 'hidden' });
  await page.locator('.pulse-panel tbody tr').filter({ hasText: 'South Point Park' }).getByText('Unknown', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Log a visit', exact: true }).click();
  await page.getByLabel('Caregiver name', { exact: true }).fill('Browser caregiver');
  await page.getByLabel('Cats actually seen').fill('7');
  await page.getByLabel('Food refilled', { exact: true }).check();
  await page.getByLabel('Field notes').fill('Fictional visit verified in the browser.');
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await page.locator('.modal').waitFor({ state: 'hidden' });
  let snapshot = await (await fetch(base + '/api/state')).json();
  assert.equal(snapshot.visits[0].author, 'Browser caregiver'); assert.equal(snapshot.stats.cats, 80);
  assert.equal(snapshot.devices[0].measurements.foodPercent, null);

  await page.getByRole('button', { name: 'Field update', exact: true }).click();
  await page.getByLabel('Caregiver name', { exact: true }).fill('Browser caregiver');
  await page.getByLabel('New cat name (optional)').fill('Browser test cat');
  await page.getByLabel('Distinctive markings').fill('Fictional orange tail and white front paw');
  await page.getByLabel('What did you observe?').fill('A new identity for manual review.');
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await page.locator('.modal').waitFor({ state: 'hidden' });
  snapshot = await (await fetch(base + '/api/state')).json();
  assert.equal(snapshot.stats.cats, 81);
  assert.ok(snapshot.tasks.some(t => t.title.includes('Browser test cat')));

  await page.getByRole('button', { name: 'Field queue', exact: false }).first().click();
  await page.getByRole('button', { name: 'Manage task' }).first().click();
  await page.getByLabel('Assigned caregiver').fill('Browser caregiver');
  await page.getByLabel('Task status', { exact: true }).selectOption('assigned');
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await page.locator('.modal').waitFor({ state: 'hidden' });
  assert.ok((await (await fetch(base + '/api/state')).json()).tasks.some(t => t.assignee === 'Browser caregiver'));

  await page.getByRole('button', { name: 'Colonies', exact: true }).click();
  await page.getByRole('button', { name: '+ Add colony', exact: true }).click();
  await page.getByLabel('Colony name', { exact: true }).fill('Browser hardware colony');
  await page.getByLabel('Neighborhood (no exact address)').fill('Fictional pilot area');
  await page.getByLabel('Primary caregiver').fill('Browser caregiver');
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await page.locator('.modal').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Stations', exact: true }).click();
  await page.getByRole('button', { name: 'Provision station', exact: true }).click();
  await page.getByLabel('Colony', { exact: true }).selectOption({ label: 'Browser hardware colony' });
  await page.getByLabel('Station name', { exact: true }).fill('Browser hardware station');
  await page.getByLabel('Lifecycle').selectOption('deployed');
  await page.getByLabel('Site permission and suitable location recorded').check();
  await page.getByLabel('Sensor readings and calibration verified on the bench').check();
  await page.getByLabel('Protected enclosure, safe cabling, and sheltered sonar installed').check();
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await page.getByRole('heading', { name: 'Your station is provisioned' }).waitFor();
  const credentials = await page.locator('.credential-block').innerText();
  const deviceId = credentials.match(/DEVICE_ID=(.+)/)[1], key = credentials.match(/DEVICE_API_KEY=(.+)/)[1];
  await page.getByRole('button', { name: 'I saved the key' }).click();
  const result = await fetch(base + '/api/readings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ schemaVersion: 1, deviceId, bootId: 'browser-boot', sequence: 0, uptimeMs: 10000, sampledAt: new Date().toISOString(),
      sonarDistanceCm: 10, sonarValidSamples: 5, rainAnalog: 900, rainDigital: 1, waterAnalog: 100 }) });
  assert.equal(result.status, 202);
  await page.getByRole('button', { name: 'Colonies', exact: true }).click();
  await page.locator('.pulse-panel tbody tr').filter({ hasText: 'Browser hardware colony' }).getByText('80%', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.pulse-panel tbody tr').count(), 7);

  await page.getByRole('button', { name: 'Community brief', exact: true }).click();
  await page.getByRole('heading', { name: 'The research & pilot plan' }).waitFor();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/mobile rendering, no console errors, scenario → API → unknown reading, visit persistence, identity review task, task assignment, station provisioning → authenticated telemetry → visible 80% food reserve, reload persistence, research navigation.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve)); context.store.close();
}
