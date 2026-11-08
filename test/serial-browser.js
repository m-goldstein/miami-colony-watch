import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { DEFAULT_CALIBRATION } from '../server/domain.js';
const app = createApp({ dbPath: ':memory:', demoMode: true });
const server = await new Promise(resolve => { const s = app.app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const cache = join(homedir(), '.cache/ms-playwright');
const cached = existsSync(cache) ? readdirSync(cache).filter(p => /^chromium-\d+$/.test(p)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])).map(p => join(cache, p, 'chrome-linux64/chrome')).find(existsSync) : null;
const executablePath = process.env.BROWSER_PATH || (existsSync(chromium.executablePath()) ? undefined : cached);
let browser;
try {
  async function post(path, body) { return (await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
  const colony = await post('/api/colonies', { name: 'USB test colony', neighborhood: 'Fictional bench', caretaker: 'Test operator' });
  const station = await post('/api/devices', { colonyId: colony.id, name: 'USB bench station', lifecycle: 'deployed', calibration: DEFAULT_CALIBRATION,
    sitePermission: true, benchPassed: true, weatherProtected: true });
  browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    const board = {
      commands: [], chooserGestures: [], ports: [], cancelNext: true, busyNext: false,
      emitText(text) { const bytes = new TextEncoder().encode(text); this.port.controller.enqueue(bytes.slice(0, 13)); if (bytes.length > 13) this.port.controller.enqueue(bytes.slice(13)); },
      emitReading(patch = {}) {
        const frame = { schemaVersion: 1, sequence: this.port.sequence++, uptimeMs: 10000,
          sonarDistanceCm: 20, sonarValidSamples: 5, rainAnalog: 900, rainDigital: 1, waterAnalog: 100,
          foodPercent: 40, waterIndex: 0, rainWet: false, temperatureC: 26, encoderPosition: 0, buttonPressed: false, screen: 0, ...patch };
        this.emitText(JSON.stringify(frame) + '\r\n');
      }
    };
    class Port {
      async open(options) {
        if (board.busyNext) { board.busyNext = false; throw new DOMException('Port busy', 'NetworkError'); }
        this.sequence = 0; this.options = options; this.closed = false;
        this.readable = new ReadableStream({ start: controller => { this.controller = controller; } });
        this.writable = new WritableStream({ write: bytes => {
          const command = new TextDecoder().decode(bytes).trim(); board.commands.push(command);
          if (command === 'HELLO') board.emitText('{"event":"hello","firmware":"colony-monitor/1.2","protocolVersion":1,"telemetryIntervalMs":10000}\n');
          if (command.startsWith('STREAM ')) board.emitText(JSON.stringify({ event: 'stream', intervalMs: Number(command.slice(7)) }) + '\n');
          if (command === 'SAMPLE') board.emitReading();
        } });
        queueMicrotask(() => board.emitText('{"event":"boot","firmware":"colony-monitor/1.2"}\n'));
      }
      async close() { if (this.readable.locked || this.writable.locked) throw new Error('Serial locks were not released'); this.closed = true; }
    }
    class Serial extends EventTarget {
      async requestPort() {
        board.chooserGestures.push(navigator.userActivation.isActive);
        if (board.cancelNext) { board.cancelNext = false; throw new DOMException('Cancelled', 'NotFoundError'); }
        board.port = new Port(); board.ports.push(board.port); return board.port;
      }
    }
    Object.defineProperty(navigator, 'serial', { value: new Serial(), configurable: true });
    window.__board = board;
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /cats need a plan/ }).waitFor();
  assert.equal(await page.locator('#food-value').innerText(), '72%');
  assert.match(await page.locator('#source-label').innerText(), /fictional data/);
  assert.equal(await page.locator('#workspace-colonies').innerText(), '6');
  assert.equal(await page.locator('#workspace-stations').innerText(), '6');
  assert.match(await page.locator('#workspace-scope').innerText(), /Fictional demo/);
  assert.ok(await page.locator('.hero-photo img').evaluate(img => img.complete && img.naturalWidth > 0));
  assert.equal(await page.locator('#map-expand').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#map-filters-panel').isVisible(), false);
  const previewHeight = await page.locator('.map-canvas').evaluate(map => map.getBoundingClientRect().height);
  await page.getByRole('button', { name: 'Expand map', exact: true }).click();
  assert.equal(await page.locator('#map-expand').getAttribute('aria-expanded'), 'true');
  assert.ok(await page.locator('.map-canvas').evaluate(map => map.getBoundingClientRect().height) > previewHeight);
  assert.equal(await page.locator('.colony-map-pin').count(), 6);
  assert.equal(await page.locator('#map-colony-name').innerText(), 'South Point Park');
  assert.equal(await page.locator('#map-food').innerText(), '18%');
  await page.getByRole('button', { name: 'View Banyan Corner', exact: true }).click();
  assert.equal(await page.locator('#map-colony-name').innerText(), 'Banyan Corner');
  assert.equal(await page.locator('#map-food').innerText(), '72%');
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#map-colony-link').click();
  const colonyPage = await popupPromise;
  await colonyPage.getByRole('button', { name: 'Log a visit', exact: true }).click();
  assert.equal(await colonyPage.getByLabel('Colony', { exact: true }).locator('option:checked').innerText(), 'Banyan Corner');
  await colonyPage.close();
  await page.locator('[data-map-filter="rain"]').click();
  assert.equal(await page.locator('.colony-map-pin').count(), 1);
  assert.equal(await page.locator('#map-colony-name').innerText(), 'Railway Garden');
  await page.locator('[data-map-filter="water"]').click();
  assert.equal(await page.locator('#map-colony-list button').count(), 1);
  assert.equal(await page.locator('#map-colony-name').innerText(), 'Railway Garden');
  await page.locator('[data-map-filter="food"]').click();
  assert.equal(await page.locator('#map-colony-name').innerText(), 'South Point Park');
  await page.locator('[data-map-filter="offline"]').click();
  assert.equal(await page.locator('#map-colony-name').innerText(), 'Orchid Landing');
  assert.equal(await page.locator('#map-food').innerText(), 'Unknown');
  assert.equal(await page.locator('#food-value').innerText(), '72%'); // Map selection never changes the station preview.
  await page.locator('[data-map-filter="all"]').click();
  await page.locator('#map-colony-list [data-colony="col-mangrove"]').click();
  await page.locator('#refresh-map').click();
  await page.locator('#map-fetch-status').filter({ hasText: 'Saved records refreshed.' }).waitFor();
  mkdirSync('test-results', { recursive: true });
  await page.locator('#network').screenshot({ path: 'test-results/colony-map-desktop.png' });
  await page.locator('[data-map-filter="all"]').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#map-expand').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#map-filters-panel').isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'map-expand');
  assert.equal(await page.locator('#map-colony-name').innerText(), 'South Point Park');
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: 'test-results/colony-home-desktop.png', fullPage: true });
  await page.screenshot({ path: 'test-results/colony-dashboard-viewport.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#map-expand').click();
  await page.locator('#network').screenshot({ path: 'test-results/colony-map-mobile.png', style: '.bottom-nav{visibility:hidden}' });
  await page.locator('#map-expand').click();
  assert.equal(await page.locator('#food-value').innerText(), '72%');
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: 'test-results/colony-home-mobile.png', fullPage: true });
  assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= window.innerWidth), true);
  await page.locator('.mobile-menu summary').click();
  await page.locator('.mobile-menu a[href="#monitor"]').click();
  assert.equal(await page.locator('.mobile-menu').evaluate(menu => menu.open), false);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('#map-expand').click();
    await page.locator('[data-map-filter="offline"]').click();
    assert.equal(await page.locator('#map-food').innerText(), 'Unknown');
    assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('.map-measurements strong').evaluateAll(values => values.every(value => value.getBoundingClientRect().width <= value.parentElement.clientWidth - 2)), true);
    await page.locator('[data-map-filter="all"]').click();
    await page.locator('#map-colony-list [data-colony="col-mangrove"]').click();
    await page.locator('#map-expand').click();
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  for (const [scenario, label] of [['hot', 'Heat risk'], ['cold', 'Cold risk'], ['freezing', 'Freezing risk']]) {
    await page.locator(`[data-scenario="${scenario}"]`).click();
    assert.equal(await page.locator('#temperature-status').innerText(), label);
    assert.equal(await page.locator('#temperature-alert').isVisible(), true);
    assert.equal(await page.locator('#care').getAttribute('data-kind'), scenario);
  }
  await page.locator('[data-scenario="hot"]').click();
  await page.locator('#temperature-card').screenshot({ path: 'test-results/temperature-heat-desktop.png' });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('#temperature-card > p').evaluateAll(paragraphs => {
      const boxes = paragraphs.filter(p => !p.hidden).map(p => p.getBoundingClientRect());
      return boxes.every((box, i) => i === 0 || box.top >= boxes[i - 1].bottom - 1);
    }), true, 'Temperature instructions must not overlap at mobile widths');
  }
  await page.locator('#temperature-card').screenshot({ path: 'test-results/temperature-heat-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator('[data-scenario="food"]').click();
  await page.locator('#food-value').filter({ hasText: '14%' }).waitFor();
  assert.equal(await page.locator('body').evaluate(body => body.classList.contains('food-low')), true);
  await page.locator('#care-action').click();
  await page.locator('#food-value').filter({ hasText: '92%' }).waitFor();
  assert.equal(app.store.list('visits').length, 0);
  await page.locator('[data-scenario="water"]').click();
  assert.equal(await page.locator('body').evaluate(body => body.classList.contains('flooding') && body.classList.contains('raining')), true);
  await page.screenshot({ path: 'test-results/colony-storm-desktop.png', fullPage: true });
  await page.locator('[data-scenario="offline"]').click();
  assert.equal(await page.locator('#food-value').innerText(), '—');
  await page.locator('#care-action').click();
  await page.locator('#food-value').filter({ hasText: '72%' }).waitFor();
  await page.locator('#start-tour').click();
  await page.locator('#food-value').filter({ hasText: '14%' }).waitFor();
  await page.locator('#tour-next').click();
  await page.locator('#food-value').filter({ hasText: '92%' }).waitFor();
  await page.locator('#tour-next').click();
  assert.equal(await page.locator('#water-value').innerText(), '84 / 100');
  await page.locator('#tour-next').click();
  await page.getByRole('dialog').waitFor();
  await page.locator('#visit-cats').fill('3');
  await page.locator('#visit-notes').fill('Fictional guided shelter check.');
  await page.locator('#visit-submit').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.match(await page.locator('#care-timeline').innerText(), /demo visit/);
  assert.equal(app.store.list('visits').length, 0); // Preview visit never writes real care data.
  assert.equal(await page.locator('#save-reading').isDisabled(), true);
  await page.locator('[data-scenario="calm"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= window.innerWidth), true);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator('#mode-live').click();
  await page.locator('#map-expand').click();
  assert.equal(await page.locator('#workspace-colonies').innerText(), '1');
  assert.equal(await page.locator('#workspace-stations').innerText(), '1');
  assert.match(await page.locator('#workspace-scope').innerText(), /Physical records/);
  assert.equal(await page.locator('#map-colony-name').innerText(), 'USB test colony');
  assert.equal(await page.locator('#map-colony-list button').count(), 1);
  assert.equal(await page.locator('#map-food').innerText(), 'Unknown');
  assert.equal(await page.locator('#food-value').innerText(), '—');
  await page.getByRole('button', { name: 'Connect Arduino', exact: true }).click();
  await page.locator('#connection-message').filter({ hasText: 'No port selected.' }).waitFor();
  assert.equal(await page.locator('#connect').isEnabled(), true);
  await page.evaluate(() => { window.__board.busyNext = true; });
  await page.locator('#connect').click();
  await page.getByText(/Port busy/).first().waitFor();
  await page.locator('#connect').click();
  await page.getByText('USB connected', { exact: true }).waitFor();
  await page.locator('#food-value').filter({ hasText: '40%' }).waitFor();
  await page.locator('#map-expand').click();
  assert.equal(await page.locator('#connection-label').innerText(), 'USB connected');
  assert.equal(await page.locator('#food-value').innerText(), '40%');
  await page.locator('#map-expand').click();
  await page.locator('#station-tools > summary').click();
  assert.equal(await page.locator('#sonar-value').innerText(), '20.0 cm');
  assert.equal(await page.locator('#rain-value').innerText(), 'Dry');
  assert.equal(await page.locator('#water-value').innerText(), '0 / 100');
  assert.ok((await page.evaluate(() => window.__board.chooserGestures)).every(Boolean));
  await page.locator('#stream-interval').selectOption('500');
  await page.getByText('Board interval: 0.5s', { exact: true }).waitFor();
  await page.locator('#sample').click();
  assert.ok((await page.evaluate(() => window.__board.commands)).includes('SAMPLE'));
  await page.evaluate(() => window.__board.emitText('not JSON\n'));
  await page.getByText('1 rejected live frames', { exact: true }).waitFor();
  await page.evaluate(() => window.__board.emitReading({ rainWet: true, rainAnalog: 230, rainDigital: 0, waterAnalog: 800, waterIndex: 100, encoderPosition: 3, screen: 1, buttonPressed: true }));
  await page.locator('#rain-value').filter({ hasText: 'Wet' }).waitFor();
  assert.equal(await page.locator('#encoder-value').innerText(), '3');
  assert.equal(await page.locator('#encoder-button').innerText(), 'Button: PRESSED');
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/usb-sensors-desktop.png', fullPage: true });

  await page.locator('.workspace-save summary').click();
  await page.getByRole('button', { name: 'Load stations', exact: true }).click();
  await page.locator('#station-id').selectOption(station.device.id);
  assert.equal(await page.locator('#station-id option').count(), 2); // No demo stations offered.
  await page.getByLabel('Station device key').fill(station.deviceKey);
  await page.locator('#sample').click();
  await page.getByRole('button', { name: 'Save latest reading', exact: true }).click();
  await page.getByText('Saved to the colony workspace. Tasks and dashboard will update.', { exact: true }).waitFor();
  assert.equal(app.store.latest(station.device.id).sonarDistanceCm, 20);
  assert.equal(app.store.latest(station.device.id).source, 'hardware');
  await page.locator('#map-food').filter({ hasText: '40%' }).waitFor();
  await page.locator('#save-reading').click();
  await page.getByText('This reading was already saved. No duplicate record created.', { exact: true }).waitFor();
  assert.equal(app.store.history(station.device.id).length, 1);
  assert.ok((await page.evaluate(() => window.__board.commands)).includes('A'));
  assert.ok((await page.evaluate(() => window.__board.commands)).includes('B'));
  assert.ok(!(await page.locator('#serial-log').innerText()).includes(station.deviceKey));
  for (const [temperatureC, status, taskType] of [[32, 'Heat risk', 'temperature-hot'], [7, 'Cold risk', 'temperature-cold'], [0, 'Freezing risk', 'temperature-freezing']]) {
    await page.evaluate(value => window.__board.emitReading({ temperatureC: value, screen: 4 }), temperatureC);
    await page.locator('#temperature-status').filter({ hasText: status }).waitFor();
    assert.match(await page.locator('#screen-value').innerText(), /5\/5.*Temperature/);
    await page.locator('#save-reading').click();
    await page.getByText('Saved to the colony workspace. Tasks and dashboard will update.', { exact: true }).waitFor();
    assert.equal(app.store.latest(station.device.id).temperatureC, temperatureC);
    assert.ok(app.store.list('tasks').some(task => task.deviceId === station.device.id && task.type === taskType));
    await page.locator('#map-temperature').filter({ hasText: `${temperatureC.toFixed(1)}°C` }).waitFor();
  }
  await page.locator('[data-map-filter="temperature"]').click();
  assert.equal(await page.locator('#map-colony-list button').count(), 1);
  await page.locator('[data-map-filter="all"]').click();
  await page.evaluate(() => window.__board.emitReading({ temperatureC: null }));
  await page.locator('#temperature-value').filter({ hasText: 'Unknown' }).waitFor();
  assert.equal(await page.locator('#temperature-alert').isVisible(), false);
  assert.equal(await page.locator('#care').getAttribute('data-kind'), 'temperature-unknown');
  await page.evaluate(() => window.__board.emitReading());
  await page.locator('#temperature-value').filter({ hasText: '26.0°C' }).waitFor();
  await page.locator('#log-visit').click();
  await page.locator('#visit-author').fill('Browser caregiver');
  await page.locator('#visit-cats').fill('2');
  await page.locator('#visit-food').check();
  await page.locator('#visit-notes').fill('Actual UI care record; no fabricated food reading.');
  await page.locator('#visit-submit').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(app.store.list('visits')[0].author, 'Browser caregiver');
  assert.equal(app.store.latest(station.device.id).sonarDistanceCm, 20);

  await page.evaluate(() => window.__board.emitReading({ sonarDistanceCm: null, sonarValidSamples: 0, foodPercent: null }));
  await page.locator('#food-value').filter({ hasText: 'Unknown' }).waitFor();
  assert.equal(await page.locator('#sonar-value').innerText(), 'No echo');
  await page.locator('#save-reading').click();
  await page.getByText('Saved to the colony workspace. Tasks and dashboard will update.', { exact: true }).waitFor();
  assert.equal(app.store.latest(station.device.id).sonarDistanceCm, null);
  const downloadPromise = page.waitForEvent('download'); await page.locator('#download').click();
  assert.match((await downloadPromise).suggestedFilename(), /\.jsonl$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/usb-sensors-mobile.png', fullPage: true });
  assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= window.innerWidth), true);
  await page.waitForFunction(() => document.getElementById('temperature-status').textContent === 'Reading unavailable', { timeout: 8000 });
  assert.equal(await page.locator('#temperature-value').innerText(), 'Unknown');
  assert.equal(await page.locator('#temperature-alert').isVisible(), false);
  await page.locator('#disconnect').click();
  await page.getByText('Disconnected', { exact: true }).waitFor();
  assert.equal(await page.locator('#device-key').inputValue(), '');
  assert.equal(await page.locator('#food-value').innerText(), '—');
  assert.equal(await page.evaluate(() => window.__board.port.closed), true);
  await page.locator('#connect').click();
  await page.getByText('USB connected', { exact: true }).waitFor();
  await page.evaluate(() => window.__board.port.controller.error(new DOMException('Cable removed', 'NetworkError')));
  await page.getByText('Disconnected', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__board.port.closed), true);
  assert.deepEqual(errors, []);

  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() => Object.defineProperty(navigator, 'serial', { value: undefined, configurable: true }));
  await unsupported.goto(base + '/serial.html');
  await unsupported.locator('#mode-live').click();
  await unsupported.locator('#support-notice').waitFor();
  assert.equal(await unsupported.locator('#connect').isDisabled(), true);
  assert.match(await unsupported.locator('#support-notice').innerText(), /does not expose Web Serial/);
  const firmware = await fetch(base + '/firmware/colony_monitor.ino');
  assert.equal(firmware.status, 200); assert.match(await firmware.text(), /colony-monitor\/1.2/);
  console.log('PASS: browser USB chooser cancellation/busy recovery, live fragmented telemetry, DHT11 heat/cold/freezing display and saved tasks, thermal map filters, missing/stale temperature, command round trips, malformed-frame recovery, authenticated manual saves and replay, unknown echo, download, mobile layout, disconnect/reconnect/cable removal, unsupported-browser guidance. Serial hardware is mocked.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve)); app.store.close();
}
