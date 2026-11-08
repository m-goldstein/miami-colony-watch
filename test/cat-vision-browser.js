import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createApp } from '../server/app.js';
import { createCatVisionService } from '../server/cat-vision.js';

// Live mode is an explicit, one-request smoke test. Normal tests never spend API credits.
const live = process.env.CAT_VISION_LIVE_TEST === '1';
if (live && !process.env.OPENAI_API_KEY) throw new Error('Live smoke test needs OPENAI_API_KEY in the server environment.');
const example = { catPresence: 'single_cat', imageQuality: 'good', description: 'Brown tabby with a white chin and dark forehead stripes.',
  coatColors: ['brown', 'white'], coatPattern: 'tabby', distinctiveMarkings: ['White chin', 'Dark forehead stripes'],
  matches: [{ catId: 'example-cat-1', similarity: 'strong', reason: 'White chin and stripe pattern resemble Mango’s reference.', differences: 'Compare the side markings before confirming.' }],
  limitations: 'Similar appearance is a suggestion, not proof of identity.' };
let calls = 0, nextResult = example, providerError = false;
const service = createCatVisionService(live ? {} : { apiKey: 'browser-test-secret', fetchImpl: async (url, options) => {
  calls++; const input = JSON.parse(options.body);
  assert.equal(input.store, false); assert.equal(input.text.format.strict, true);
  assert.ok(input.input[0].content.filter(item => item.type === 'input_image').length <= 7);
  if (providerError) return new Response('browser-test-secret must never reach the UI', { status: 401 });
  return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(nextResult) }] }] }));
} });
const context = createApp({ dbPath: ':memory:', catVisionService: service });
const server = await new Promise(resolve => { const running = context.app.listen(0, '127.0.0.1', () => resolve(running)); });
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  const state = async () => (await page.request.get(base + '/api/care-demo')).json();
  const upload = async (author, file = 'public/assets/miami-community-cat.png', analyze = true) => {
    await page.locator('#open-phone-update').click();
    await page.locator('#field-ai-availability').filter({ hasText: 'OpenAI analyzes' }).waitFor();
    assert.equal(await page.locator('#field-ai-check').isChecked(), true);
    await page.locator('#phone-update-author').fill(author); await page.locator('#phone-update-text').fill('Cat at the feeding corner. Please check the food area.');
    await page.locator('#phone-update-care').check();
    if (!analyze) await page.locator('#field-ai-check').uncheck();
    await page.locator('#field-photo').setInputFiles(file);
    await page.locator('#field-photo-status').filter({ hasText: 'ready to attach' }).waitFor();
    const response = analyze ? page.waitForResponse(res => res.url().endsWith('/analyze'), { timeout: 60000 }) : null;
    await page.locator('#phone-update-form [type=submit]').click();
    await page.locator('#phone-update-dialog').waitFor({ state: 'hidden' });
    if (response) return response;
  };
  const firstResponse = await upload('First photo reporter');
  if (firstResponse.status() !== 200) {
    const safeError = await firstResponse.json(); throw new Error(`Photo analysis failed (${firstResponse.status()}): ${safeError.error}`);
  }
  await page.locator('#review-ai-panel .ai-photo-summary').waitFor();
  let s = await state(), first = s.updates.at(-1), result = s.photoAnalyses[first.photo.id];
  assert.equal(result.provider, 'OpenAI'); assert.equal(result.humanReviewRequired, true); assert.equal(s.cats.length, 14); assert.equal(s.tasks.length, 0);
  const cached = page.waitForResponse(res => res.url().endsWith('/analyze'));
  await page.locator('#review-ai-panel [data-ai-analyze]').click(); assert.equal((await (await cached).json()).cached, true);
  if (live) {
    assert.equal(result.catPresence, 'single_cat');
    console.log(`LIVE PASS: OpenAI ${result.model} classified the uploaded cat photo, returned ${result.matches.length} review suggestion(s), and reused the saved result without another model call. No identity or care ticket was created.`);
  } else {
    assert.equal(calls, 1); assert.equal(result.matches[0].catId, 'example-cat-1');
    await page.locator('[data-ai-match="example-cat-1"]').click();
    assert.equal(await page.locator('#review-cat').inputValue(), 'example-cat-1');
    assert.equal((await state()).cats[0].observations.length, 0, 'choosing an AI suggestion alone must not save an identity decision');
    mkdirSync('test-results', { recursive: true });
    await page.locator('#field-updates').screenshot({ path: 'test-results/ai-photo-review-desktop.png', animations: 'disabled' });
    await page.locator('#confirm-update').click(); await page.locator('#review-receipt').waitFor();
    s = await state(); const taskId = s.tasks[0].id;
    assert.equal(s.cats[0].photo, first.photo.url, 'the human-linked upload becomes a reference for later sightings');
    assert.equal(s.cats.length, 14); assert.equal(s.tasks.length, 1);
    await upload('Second photo reporter');
    await page.locator('[data-ai-match="example-cat-1"]').waitFor();
    assert.match(await page.locator('.ai-open-tickets').innerText(), /1 open care ticket/);
    await page.locator('[data-ai-match="example-cat-1"]').click(); await page.locator('#review-ticket').selectOption(taskId);
    await page.locator('#confirm-update').click(); await page.locator('#review-receipt').waitFor();
    s = await state(); assert.equal(s.cats.length, 14); assert.equal(s.tasks.length, 1); assert.equal(s.tasks[0].sourceIds.length, 2);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#review-ai-panel .ai-photo-summary').waitFor();
    assert.equal((await state()).photoAnalyses[first.photo.id].catPresence, 'single_cat');
    await page.locator('.rescue-task [data-followup]').click();
    await page.locator('#task-photo').setInputFiles('public/assets/miami-community-cat.png');
    await page.locator('#task-photo-status').filter({ hasText: 'ready to attach' }).waitFor();
    assert.equal(await page.locator('#task-ai-check').isChecked(), true);
    const ticketAnalysis = page.waitForResponse(res => res.url().endsWith('/analyze'));
    await page.locator('#followup-form [type=submit]').click();
    await page.locator('#followup-dialog').waitFor({ state: 'hidden' });
    assert.equal((await ticketAnalysis).status(), 200);
    assert.equal((await state()).tasks[0].photos[0].id, first.photo.id);
    assert.match(await page.locator('.ticket-ai-row').innerText(), /One cat visible/);
    const newImage = async color => {
      const dataUrl = await page.evaluate(color => { const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80; const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 80, 80); return canvas.toDataURL('image/png'); }, color);
      return { name: 'test-scene.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') };
    };
    nextResult = { ...example, catPresence: 'no_cat', description: 'No cat is visible in this image.', matches: [], coatColors: ['unknown'], coatPattern: 'unknown', distinctiveMarkings: [] };
    await upload('Non-cat photo reporter', await newImage('#228844'));
    await page.locator('.ai-photo-summary.no_cat').waitFor(); assert.equal(await page.locator('[data-ai-match]').count(), 0); assert.equal((await state()).cats.length, 14);
    providerError = true;
    const failed = await upload('Unavailable AI reporter', await newImage('#aa4422'));
    assert.equal(failed.status(), 503); await page.locator('#review-ai-panel .ai-analysis-error').waitFor();
    assert.match(await page.locator('#review-ai-panel .ai-analysis-error').innerText(), /authorize/);
    assert.equal(await page.locator('#source-review-form').isVisible(), true); assert.equal((await state()).updates.length, 4);
    const beforeOptOut = calls;
    await upload('Manual review reporter', await newImage('#2255aa'), false);
    assert.equal(calls, beforeOptOut);
    assert.equal(await page.locator('#review-ai-panel [data-ai-analyze]').isEnabled(), true);
    assert.equal((await page.content()).includes('browser-test-secret'), false);
    await page.locator(`[data-update="${first.id}"]`).click();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `AI review overflow at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#review-ai-panel').screenshot({ path: 'test-results/ai-photo-review-mobile.png', animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log('PASS: optional automatic photo analysis, appearance and candidate cards, cached retries, human-confirmed tracking and duplicate tickets, new reference photo, saved results, non-cat handling, provider failure recovery, opt-out, secret isolation and mobile layouts.');
  }
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); context.store.close(); }
