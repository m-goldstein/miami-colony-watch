import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApp } from '../server/app.js';
import { catVisionContext, createCatVisionService } from '../server/cat-vision.js';

const modelResult = extra => ({ catPresence: 'single_cat', imageQuality: 'good', description: 'Brown tabby with a white chin and dark forehead stripes.',
  coatColors: ['brown', 'white'], coatPattern: 'tabby', distinctiveMarkings: ['White chin'],
  matches: [{ catId: 'example-cat-1', similarity: 'strong', reason: 'Tabby stripes and white chin resemble the reference.', differences: 'The left side is obscured; compare in person.' }],
  limitations: 'A photo cannot establish identity.', ...extra });
const response = value => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const basicContext = { fingerprint: 'roster-one', cats: [{ id: 'example-cat-1', name: 'Mango', description: 'Brown tabby', aliases: [] }], references: [], scope: { totalCats: 1, comparedCats: 1, referencePhotos: 0, limited: true } };
const input = { photoId: 'test-photo', data: Buffer.from('fake image bytes for mocked transport'), context: basicContext };

test('vision uses a private Responses request with bounded schema output and validated appearance suggestions', async () => {
  let captured;
  const service = createCatVisionService({ apiKey: 'test-secret', fetchImpl: async (url, options) => { captured = { url, options, body: JSON.parse(options.body) }; return response(modelResult()); } });
  const result = await service.analyze(input);
  assert.equal(captured.url, 'https://api.openai.com/v1/responses'); assert.equal(captured.options.headers.Authorization, 'Bearer test-secret');
  assert.equal(captured.body.store, false); assert.equal(captured.body.max_output_tokens, 1600); assert.equal(captured.body.text.format.strict, true);
  assert.equal(captured.body.input[0].content.filter(item => item.type === 'input_image').length, 1);
  assert.match(captured.body.instructions, /untrusted evidence/); assert.match(captured.body.instructions, /human must confirm/);
  assert.equal(result.matches[0].similarity, 'possible', 'description-only resemblance must not be presented as strong');
  assert.equal(result.matches[0].basis, 'description_only'); assert.equal(result.humanReviewRequired, true);
  assert.equal(JSON.stringify(result).includes('test-secret'), false);
});

test('no-cat, multiple-cat, unclear and poor photos cannot produce identity suggestions', async () => {
  for (const fields of [{ catPresence: 'no_cat' }, { catPresence: 'multiple_cats' }, { catPresence: 'unclear' }, { imageQuality: 'poor' }]) {
    const service = createCatVisionService({ apiKey: 'test', fetchImpl: async () => response(modelResult(fields)) });
    assert.deepEqual((await service.analyze(input)).matches, []);
  }
});

test('malformed model output, unknown identity IDs, refusals and incomplete responses are not saved as matches', async () => {
  for (const fetchImpl of [
    async () => response(modelResult({ matches: [{ catId: 'made-up-id', similarity: 'strong', reason: 'x', differences: '' }] })),
    async () => response(modelResult({ coatColors: 'brown' })),
    async () => new Response(JSON.stringify({ status: 'incomplete', output: [] })),
    async () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'private provider text' }] }] })),
    async () => new Response('unparseable')
  ]) {
    const service = createCatVisionService({ apiKey: 'test', fetchImpl });
    await assert.rejects(service.analyze(input), error => [422, 502].includes(error.status) && !error.message.includes('private provider text'));
  }
});

test('provider failures never echo secrets or payloads and unavailable configuration has no network effects', async () => {
  let calls = 0;
  const absent = createCatVisionService({ apiKey: '', fetchImpl: async () => { calls++; } });
  await assert.rejects(absent.analyze(input), error => error.status === 503); assert.equal(calls, 0);
  for (const [upstream, expected] of [[401, 503], [403, 503], [429, 429], [500, 502]]) {
    const service = createCatVisionService({ apiKey: 'private-test-secret', fetchImpl: async () => new Response('private-test-secret and original private photo', { status: upstream }) });
    await assert.rejects(service.analyze(input), error => error.status === expected && !/private/.test(error.message));
  }
  const failed = createCatVisionService({ apiKey: 'test', fetchImpl: async () => { throw new Error('private transport details'); } });
  await assert.rejects(failed.analyze(input), error => error.status === 504 && !/private/.test(error.message));
});

test('identical concurrent requests coalesce, unrelated concurrency is bounded, and new calls are rate limited', async () => {
  let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const service = createCatVisionService({ apiKey: 'test', fetchImpl: async () => { calls++; await gate; return response(modelResult()); } });
  const first = service.analyze(input), same = service.analyze(input), second = service.analyze({ ...input, photoId: 'second' });
  await assert.rejects(service.analyze({ ...input, photoId: 'third' }), error => error.status === 429);
  release(); assert.deepEqual(await first, await same); await second; assert.equal(calls, 2);
  for (let n = 0; n < 4; n++) await service.analyze({ ...input, photoId: `next-${n}` });
  await assert.rejects(service.analyze({ ...input, photoId: 'over-budget' }), error => error.status === 429); assert.equal(calls, 6);
});

async function fixture(fetchImpl, options = {}) {
  const service = createCatVisionService({ apiKey: 'fixture-secret', fetchImpl });
  const context = createApp({ dbPath: ':memory:', catVisionService: service, ...options });
  const server = await new Promise(resolve => { const running = context.app.listen(0, '127.0.0.1', () => resolve(running)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path = '', body) => {
    const res = await fetch(`${base}/api/care-demo${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  const bytes = Buffer.from('stored photo bytes for mocked transport'), photoId = createHash('sha256').update(bytes).digest('hex');
  context.store.db.prepare('INSERT INTO care_photos (id, data) VALUES (?, ?)').run(photoId, bytes);
  return { context, service, photoId, request, close: async () => { await new Promise(resolve => server.close(resolve)); context.store.close(); } };
}

test('photo results cache in SQLite, track roster changes and never create cats, sightings or care tickets', async () => {
  let calls = 0;
  const f = await fixture(async () => { calls++; return response(modelResult()); });
  try {
    const before = (await f.request()).data;
    const path = `/photos/${f.photoId}/analyze`;
    let result = await f.request(path, {}); assert.equal(result.status, 200); assert.equal(result.data.cached, false);
    assert.equal(result.data.analysis.matches[0].basis, 'photo_and_record');
    result = await f.request(path, {}); assert.equal(result.data.cached, true); assert.equal(calls, 1);
    const after = (await f.request()).data;
    assert.deepEqual(after.cats, before.cats); assert.deepEqual(after.tasks, before.tasks); assert.deepEqual(after.updates, before.updates);
    assert.equal(after.events.filter(event => event.kind === 'photo_analyzed').length, 1);
    after.cats[0].description = 'Updated caregiver description'; f.context.store.put('care_demo', after);
    assert.equal((await f.request(path, {})).data.cached, false); assert.equal(calls, 2);
    assert.equal((await f.request('/photos/not-a-photo/analyze', {})).status, 404);
    assert.equal((await f.request('/photos/' + '0'.repeat(64) + '/analyze', {})).status, 404);
    const status = await f.request('/photo-analysis/status'); assert.equal(status.data.configured, true); assert.ok(!JSON.stringify(status.data).includes('fixture-secret'));
  } finally { await f.close(); }
});

test('a reset while AI is in flight cannot resurrect deleted evidence; hardware-only mode refuses analysis', async () => {
  let release, started;
  const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { started = resolve; });
  const f = await fixture(async () => { started(); await gate; return response(modelResult()); });
  try {
    const pending = f.request(`/photos/${f.photoId}/analyze`, {}); await ready;
    await f.request('/reset', { confirm: 'reset-fictional-exercise' }); release();
    assert.equal((await pending).status, 409);
    assert.equal((await f.request()).data.photoAnalyses, undefined);
  } finally { await f.close(); }
  let called = false;
  const hardware = await fixture(async () => { called = true; return response(modelResult()); }, { demoMode: false });
  try { assert.equal((await hardware.request(`/photos/${hardware.photoId}/analyze`, {})).status, 403); assert.equal(called, false); }
  finally { await hardware.close(); }
});

test('comparison context is bounded and only resolves local approved photo references', async () => {
  const f = await fixture(async () => response(modelResult()));
  try {
    const state = (await f.request()).data;
    for (let i = 0; i < 80; i++) state.cats.push({ id: `extra-${i}`, name: 'Reference cat', aliases: [], description: 'Example markings', photo: `/api/care-demo/photos/${f.photoId}` });
    state.cats[0].photo = 'https://untrusted.example/collect';
    const context = catVisionContext(state, f.context.store, f.service.model);
    assert.equal(context.cats.length, 60); assert.equal(context.references.length, 6); assert.equal(context.scope.totalCats, 94); assert.equal(context.scope.limited, true);
    assert.ok(context.references.every(reference => reference.dataUrl.startsWith('data:image/jpeg;base64,')));
  } finally { await f.close(); }
});
