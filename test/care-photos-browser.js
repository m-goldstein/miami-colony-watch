import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';

const directory = mkdtempSync(join(tmpdir(), 'colony-photos-'));
let context, server, browser, base;
const start = async () => {
  context = createApp({ dbPath: join(directory, 'photos.sqlite'), demoMode: true });
  server = await new Promise(resolve => { const running = context.app.listen(0, '127.0.0.1', () => resolve(running)); });
  base = `http://127.0.0.1:${server.address().port}`;
};
const stop = async () => { await new Promise(resolve => server.close(resolve)); context.store.close(); };
try {
  await start(); browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('#rescue-cat-count').filter({ hasText: '14' }).waitFor();
  const state = async () => (await page.request.get(`${base}/api/care-demo`)).json();
  const addReport = async author => {
    await page.locator('#open-phone-update').click();
    await page.locator('#phone-update-author').fill(author);
    await page.locator('#phone-update-text').fill('Mango at the covered corner. Please check the feeding area.');
    await page.locator('#phone-update-care').check();
    await page.locator('#field-photo').setInputFiles('public/assets/miami-community-cat.png');
    await page.locator('#field-photo-status').filter({ hasText: 'ready to attach' }).waitFor();
    await page.locator('#phone-update-form [type=submit]').click();
    await page.locator('#phone-update-dialog').waitFor({ state: 'hidden' });
    await page.locator('#review-photo').evaluate(img => img.decode());
  };
  await addReport('First caregiver');
  let s = await state(); const first = s.updates.at(-1), firstPhoto = first.photo;
  assert.ok(firstPhoto.size <= 512 * 1024); assert.ok(firstPhoto.width <= 1600); assert.ok(firstPhoto.height <= 1600);
  assert.equal((await page.request.get(base + firstPhoto.url)).headers()['content-type'], 'image/jpeg');
  assert.match(await page.locator('#review-photo-caption').innerText(), /Caregiver upload/);
  await page.locator('#review-cat').selectOption('example-cat-1');
  await page.locator('#confirm-update').click(); await page.locator('#review-receipt').waitFor();
  s = await state(); const taskId = s.tasks[0].id;
  assert.equal(s.tasks.length, 1); assert.equal(s.cats.length, 14);
  assert.equal(await page.locator('.rescue-task .ticket-photo-gallery img').count(), 1);

  await addReport('Second caregiver');
  await page.locator('#review-duplicates').waitFor();
  assert.match(await page.locator('#review-duplicates').innerText(), /already in the inbox/);
  s = await state(); const second = s.updates.at(-1);
  assert.equal(second.photo.id, firstPhoto.id); assert.deepEqual(second.samePhotoSources, [first.id]);
  const rejected = await page.request.post(`${base}/api/care-demo/updates/${second.id}/review`, { data: { decision: 'existing', catId: 'example-cat-2', reviewer: 'Tester', relatedTaskId: taskId } });
  assert.equal(rejected.status(), 409); assert.equal((await state()).updates.at(-1).status, 'pending');
  await page.locator('#review-cat').selectOption('example-cat-1');
  await page.locator('#review-ticket-wrap').waitFor();
  await page.locator('#review-ticket').selectOption(taskId);
  await page.locator('#review-evidence').fill('Same cat and issue confirmed by caregiver. Keep both original reports on one ticket.');
  await page.locator('#confirm-update').click(); await page.locator('#review-receipt').waitFor();
  s = await state(); assert.equal(s.tasks.length, 1); assert.equal(s.cats.length, 14);
  assert.deepEqual(s.tasks[0].sourceIds, [first.id, second.id]);
  assert.equal(context.store.db.prepare('SELECT COUNT(*) AS count FROM care_photos').get().count, 1);
  assert.match(await page.locator('.ticket-evidence-count').innerText(), /2 source reports/);

  await page.locator('.rescue-task [data-followup]').click();
  await page.locator('#followup-assignee').fill('Third caregiver');
  await page.locator('#task-photo').setInputFiles('public/assets/miami-community-cat.png');
  await page.locator('#task-photo-status').filter({ hasText: 'ready to attach' }).waitFor();
  await page.locator('#followup-form [type=submit]').click();
  await page.locator('#followup-dialog').waitFor({ state: 'hidden' });
  assert.equal((await state()).tasks[0].photos.length, 1);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.ticket-evidence-count').filter({ hasText: '2 source reports' }).waitFor();
  await page.locator('.rescue-task .ticket-photo-gallery img').first().evaluate(img => img.decode());
  const when = new Date().toISOString().slice(0, 10);
  const report = await (await page.request.get(`${base}/api/care-demo/report?from=${when}&to=${when}`)).json();
  assert.equal(report.period.uniqueCatsObserved, 1); assert.equal(report.period.sightings, 2); assert.equal(report.current.openTasks, 1);
  const csv = await (await page.request.get(`${base}/api/care-demo/report.csv?from=${when}&to=${when}`)).text();
  assert.ok(csv.includes(firstPhoto.url)); assert.ok(csv.includes(taskId));

  await page.locator('#open-phone-update').click();
  await page.locator('#field-photo').setInputFiles({ name: 'pretend.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await page.locator('#field-photo-status').filter({ hasText: 'Choose a JPEG' }).waitFor();
  await page.locator('#phone-update-author').fill('Test'); await page.locator('#phone-update-text').fill('Invalid attachment');
  await page.locator('#phone-update-form [type=submit]').click();
  await page.locator('#phone-update-error').waitFor(); assert.equal((await state()).updates.length, 2);
  await page.locator('#field-photo-picker button').click();
  assert.equal(await page.locator('#field-photo-picker img').isVisible(), false);
  await page.locator('#phone-update-dialog [data-close-dialog]').first().click();
  for (const dataUrl of ['data:image/svg+xml;base64,PHN2Zy8+', 'data:image/jpeg;base64,PHNjcmlwdD4=', 'data:image/jpeg;base64,' + 'A'.repeat(710000)]) {
    const response = await page.request.post(`${base}/api/care-demo/updates`, { data: { author: 'Test', text: 'Bad bytes', photo: { name: 'cat.jpg', dataUrl } } });
    assert.ok([400, 413].includes(response.status()));
  }
  assert.equal((await state()).updates.length, 2);
  assert.equal((await page.request.get(`${base}/api/care-demo/photos/not-a-photo`)).status(), 404);

  mkdirSync('test-results', { recursive: true });
  await page.locator('#today-needs').screenshot({ path: 'test-results/photo-ticket-desktop.png', animations: 'disabled' });
  await page.locator('#field-updates').screenshot({ path: 'test-results/photo-review-desktop.png', animations: 'disabled' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#open-phone-update').click();
  await page.locator('#field-photo').setInputFiles('public/assets/miami-community-cat.png');
  await page.locator('#field-photo-status').filter({ hasText: 'ready to attach' }).waitFor();
  await page.locator('#phone-update-dialog').screenshot({ path: 'test-results/photo-upload-mobile.png' });
  await page.locator('#phone-update-dialog [data-close-dialog]').first().click();

  await stop(); await start();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.ticket-evidence-count').filter({ hasText: '2 source reports' }).waitFor();
  await page.locator('.rescue-task .ticket-photo-gallery img').first().evaluate(img => img.decode());
  assert.equal((await state()).tasks[0].photos.length, 1);
  await page.request.post(`${base}/api/care-demo/reset`, { data: { confirm: 'reset-fictional-exercise' } });
  assert.equal((await page.request.get(base + firstPhoto.url)).status(), 404);
  assert.equal(context.store.list('cats').length, 80);
  assert.deepEqual(errors, []);
  console.log('PASS: resized upload, exact-photo hints, human duplicate review, one ticket/two reports, ticket attachments, malformed-file rejection, report links, responsive forms, reload/server restart, and scoped reset.');
} finally {
  if (browser) await browser.close(); if (server?.listening) await stop(); rmSync(directory, { recursive: true, force: true });
}
