import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { seedDemo } from './seed.js';
import { createWeatherService } from './weather.js';
import { careDemoRouter } from './care-demo.js';
import { id, hashKey, text, number, fail, calibration, validateReading, measurements, deviceView, evaluateDevice, DEFAULT_CALIBRATION } from './domain.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = () => new Date().toISOString();
export function createApp({ dbPath = resolve(root, 'data/colony-watch.sqlite'), demoMode = true, clientDirectory = 'public', weatherService = createWeatherService() } = {}) {
  const app = express(), store = new Store(dbPath);
  if (demoMode) seedDemo(store);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'serial=(self)',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" });
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    // Local coordinator UI only. Do not allow another website to drive writes.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('Origin');
      if (req.get('Sec-Fetch-Site') === 'cross-site' || (origin && origin !== `http://${req.get('host')}`)) return res.status(403).json({ error: 'Use the local dashboard origin' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'JSON content type required' });
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => {
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && (!req.body || Array.isArray(req.body) || typeof req.body !== 'object')) return res.status(400).json({ error: 'A JSON object is required' });
    next();
  });
  const monitor = () => store.list('devices').forEach(d => evaluateDevice(store, d));
  const requireRecord = (table, recordId) => { const record = store.get(table, recordId); if (!record) fail(`${table} record not found`, 404); return record; };
  function ingest(body, device, source) {
    const reading = { ...validateReading(body), source };
    if (reading.deviceId !== device.id) fail('Credential does not match device', 403);
    if (device.lifecycle === 'retired') fail('Device is retired', 409);
    return store.transaction(() => {
      const inserted = store.addReading(reading);
      if (inserted) {
        store.put('devices', { ...device, lastSeenAt: stamp(), lastSource: source });
        evaluateDevice(store, store.get('devices', device.id));
      }
      return { accepted: true, duplicate: !inserted };
    });
  }
  function snapshot() {
    monitor();
    const devices = store.list('devices').map(d => ({ ...deviceView(d, store.latest(d.id)),
      history: store.history(d.id).map(r => ({ at: r.sampledAt, food: measurements(r, d.calibration, Date.parse(r.sampledAt)).foodPercent })) }));
    const cats = store.list('cats'), tasks = store.list('tasks');
    const colonies = store.list('colonies').map(c => {
      const members = cats.filter(cat => cat.colonyId === c.id), station = devices.find(d => d.colonyId === c.id && d.lifecycle === 'deployed');
      const openTasks = tasks.filter(t => t.colonyId === c.id && t.status !== 'completed');
      return { ...c, catCount: members.length, tnvrCount: members.filter(cat => cat.tnvrStatus === 'confirmed').length,
        device: station || null, openTaskCount: openTasks.length,
        status: openTasks.some(t => t.severity === 'urgent') ? 'attention' : (!station || !station.online ? 'offline' : openTasks.length ? 'watch' : 'stable') };
    });
    return { demoMode, generatedAt: stamp(), colonies, devices, cats, tasks,
      visits: store.list('visits').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      observations: store.list('observations').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      stats: { colonies: colonies.length, cats: cats.length, tnvr: cats.filter(c => c.tnvrStatus === 'confirmed').length,
        online: devices.filter(d => d.online).length, deployed: devices.filter(d => d.lifecycle === 'deployed').length,
        openTasks: tasks.filter(t => t.status !== 'completed').length,
        lowFood: devices.filter(d => d.measurements.fresh && d.measurements.foodPercent !== null && d.measurements.foodPercent <= d.calibration.foodLowPercent).length,
        wetStations: devices.filter(d => d.measurements.wet || (d.measurements.waterPercent !== null && d.measurements.waterPercent >= d.calibration.waterAlertPercent)).length } };
  }
  function tickDemo() {
    if (!demoMode) return;
    for (const device of store.list('devices')) {
      if (!device.demo || device.simulationOffline || device.lifecycle !== 'deployed') continue;
      const previous = store.latest(device.id);
      if (!previous) continue;
      ingest({ ...previous, bootId: 'demo-ticker-v1', sequence: Math.floor(Date.now() / 1000),
        sampledAt: stamp(), uptimeMs: 0 }, device, 'simulation');
    }
  }
  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'colony-watch', storage: 'sqlite-local', demoMode, time: stamp() }));
  app.get('/api/state', (req, res) => res.json(snapshot()));
  app.use('/api/care-demo', careDemoRouter(store, demoMode));
  app.get('/api/weather/south-point', async (req, res) => {
    try { res.json(await weatherService()); }
    catch { res.status(503).json({ error: 'The NWS outlook could not be refreshed. Check NWS Miami for current weather and alerts.' }); }
  });
  app.post('/api/readings', (req, res) => {
    const device = requireRecord('devices', text(req.body.deviceId, 'deviceId', 80));
    const token = req.get('Authorization')?.replace(/^Bearer /, '') || '';
    const actual = Buffer.from(hashKey(token)), expected = Buffer.from(device.keyHash);
    if (!token || actual.length !== expected.length || !timingSafeEqual(actual, expected)) fail('Invalid device credential', 401);
    res.status(202).json(ingest(req.body, device, device.demo ? 'simulation' : 'hardware'));
  });
  app.post('/api/colonies', (req, res) => {
    const data = req.body;
    res.status(201).json(store.put('colonies', { id: id('col'), name: text(data.name, 'name', 70),
      neighborhood: text(data.neighborhood, 'neighborhood', 70), caretaker: text(data.caretaker, 'caretaker', 70),
      notes: text(data.notes || '', 'notes', 1500, false), stormPlan: text(data.stormPlan || '', 'stormPlan', 1000, false),
      sitePermission: data.sitePermission === true, demo: false, mapX: 45, mapY: 55, lastVisitAt: null }));
  });
  app.patch('/api/colonies/:id/preparedness', (req, res) => {
    const colony = requireRecord('colonies', req.params.id), body = req.body;
    const checklist = {};
    for (const key of ['backup', 'supplies', 'shelter', 'access', 'records']) {
      if (typeof body.checklist?.[key] !== 'boolean') fail('Complete the preparedness checklist fields');
      checklist[key] = body.checklist[key];
    }
    const preparedness = { checklist, lead: text(body.lead, 'care lead', 70, false), backup: text(body.backup, 'backup caregiver', 70, false),
      checkIn: text(body.checkIn, 'next check-in', 70, false), notes: text(body.notes, 'handoff notes', 1500, false),
      cats: number(body.cats, 'cats to plan for', 0, 500, true), days: number(body.days, 'supply days', 1, 14, true),
      grams: number(body.grams, 'daily food per cat', 1, 1000), onHandKg: number(body.onHandKg, 'packed food', 0, 1000), updatedAt: stamp() };
    store.put('colonies', { ...colony, preparedness });
    res.json(preparedness);
  });
  function deviceConfig(body, previous = {}) {
    const colonyId = text(body.colonyId, 'colonyId', 80);
    requireRecord('colonies', colonyId);
    const lifecycle = body.lifecycle || 'bench';
    if (!['planned', 'bench', 'deployed', 'maintenance', 'retired'].includes(lifecycle)) fail('Invalid lifecycle');
    const config = calibration(body.calibration || previous.calibration || DEFAULT_CALIBRATION);
    const checks = { sitePermission: body.sitePermission === true, benchPassed: body.benchPassed === true, weatherProtected: body.weatherProtected === true };
    if (lifecycle === 'deployed' && !Object.values(checks).every(Boolean)) fail('Deployment requires site permission, a passed bench check, and a protected enclosure');
    if (lifecycle === 'deployed' && store.list('devices').some(d => d.id !== previous.id && d.colonyId === colonyId && d.lifecycle === 'deployed')) fail('This colony already has a deployed station', 409);
    return { colonyId, lifecycle, calibration: config, ...checks, name: text(body.name, 'station name', 70) };
  }
  app.post('/api/devices', (req, res) => {
    const config = deviceConfig(req.body);
    const key = randomBytes(32).toString('hex');
    const device = store.put('devices', { ...config, id: id('CW'), keyHash: hashKey(key), demo: false,
      installedAt: stamp(), lastSeenAt: null, firmwareVersion: 'awaiting telemetry' });
    res.status(201).json({ device: deviceView(device, null), deviceKey: key });
  });
  app.patch('/api/devices/:id', (req, res) => {
    const device = requireRecord('devices', req.params.id);
    const config = deviceConfig(req.body, device);
    store.put('devices', { ...device, ...config });
    res.json(deviceView(store.get('devices', device.id), store.latest(device.id)));
  });
  app.patch('/api/tasks/:id', (req, res) => {
    const task = requireRecord('tasks', req.params.id);
    const status = req.body.status ?? task.status;
    if (!['open', 'assigned', 'completed'].includes(status)) fail('Invalid task status');
    const assignee = text(req.body.assignee ?? task.assignee, 'assignee', 70, false);
    if (status === 'assigned' && !assignee) fail('Enter an assignee');
    res.json(store.put('tasks', { ...task, status, assignee, updatedAt: stamp() }));
  });
  app.post('/api/visits', (req, res) => {
    const colony = requireRecord('colonies', text(req.body.colonyId, 'colonyId', 80));
    const createdAt = stamp();
    const visit = { id: id('visit'), colonyId: colony.id, author: text(req.body.author, 'author', 70),
      catsSeen: number(req.body.catsSeen, 'catsSeen', 0, 500, true), foodRefilled: req.body.foodRefilled === true,
      waterChanged: req.body.waterChanged === true, notes: text(req.body.notes || '', 'notes', 1500, false), createdAt };
    store.transaction(() => {
      store.put('visits', visit);
      store.put('colonies', { ...colony, lastVisitAt: createdAt });
    });
    res.status(201).json(visit);
  });
  app.post('/api/observations', (req, res) => {
    const colony = requireRecord('colonies', text(req.body.colonyId, 'colonyId', 80));
    const description = text(req.body.text, 'observation', 1500);
    const author = text(req.body.author, 'author', 70);
    let cat = req.body.catId ? requireRecord('cats', text(req.body.catId, 'catId', 80)) : null;
    if (cat && cat.colonyId !== colony.id) fail('Cat belongs to a different colony');
    let newIdentity = false;
    if (!cat && req.body.newCatName) {
      const name = text(req.body.newCatName, 'cat name', 70);
      const duplicate = store.list('cats').find(c => c.colonyId === colony.id && c.name.toLowerCase() === name.toLowerCase());
      if (duplicate) fail(`Possible duplicate: link to ${duplicate.name} (${duplicate.id}) or use a distinct field identity`, 409);
      cat = { id: id('cat'), colonyId: colony.id, name, description: text(req.body.description || '', 'description', 300, false),
        tnvrStatus: 'unknown', health: 'not assessed', lastSeenAt: stamp(), demo: false };
      newIdentity = true;
    }
    const observation = { id: id('obs'), colonyId: colony.id, catId: cat?.id || null, text: description, author, createdAt: stamp(), source: 'phone form' };
    store.transaction(() => {
      if (cat) store.put('cats', { ...cat, lastSeenAt: observation.createdAt });
      store.put('observations', observation);
      if (newIdentity || req.body.needsReview === true) store.put('tasks', {
        id: id('task'), colonyId: colony.id, catId: cat?.id || null,
        title: newIdentity ? `Review identity and TNVR needs: ${cat.name}` : `Review field observation${cat ? ': ' + cat.name : ''}`,
        type: newIdentity ? 'tnvr' : 'care', severity: 'warning', status: 'open', assignee: '', origin: 'volunteer',
        createdAt: observation.createdAt, updatedAt: observation.createdAt
      });
    });
    res.status(201).json(observation);
  });
  app.patch('/api/cats/:id', (req, res) => {
    const cat = requireRecord('cats', req.params.id), tnvrStatus = req.body.tnvrStatus;
    if (!['confirmed', 'needed', 'unknown'].includes(tnvrStatus)) fail('Invalid TNVR status');
    const evidence = text(req.body.evidence, 'evidence note', 500);
    res.json(store.put('cats', { ...cat, tnvrStatus, tnvrEvidence: evidence, tnvrUpdatedAt: stamp() }));
  });
  app.post('/api/demo/scenario', (req, res) => {
    if (!demoMode) fail('Demo scenarios are disabled', 403);
    const device = requireRecord('devices', text(req.body.deviceId, 'deviceId', 80));
    if (!device.demo) fail('Demo scenarios can only target fictional demo stations', 403);
    const scenario = req.body.scenario;
    if (!['low-food', 'refill', 'rain', 'standing-water', 'no-echo', 'offline', 'recover'].includes(scenario)) fail('Unknown scenario');
    if (scenario === 'offline') {
      store.put('devices', { ...device, simulationOffline: true, lastSeenAt: new Date(Date.now() - 10 * 60000).toISOString() });
      monitor(); return res.json({ accepted: true });
    }
    const latest = store.latest(device.id);
    const packet = { ...latest, deviceId: device.id, schemaVersion: 1, bootId: id('demo'), sequence: 0, uptimeMs: 0, sampledAt: stamp(), sonarValidSamples: 5 };
    if (scenario === 'low-food') packet.sonarDistanceCm = device.calibration.foodEmptyCm - 0.1 * (device.calibration.foodEmptyCm - device.calibration.foodFullCm);
    if (scenario === 'refill') packet.sonarDistanceCm = device.calibration.foodFullCm + 0.1 * (device.calibration.foodEmptyCm - device.calibration.foodFullCm);
    if (scenario === 'rain') { packet.rainAnalog = device.calibration.rainWetRaw; packet.rainDigital = device.calibration.rainActiveLow ? 0 : 1; }
    if (scenario === 'standing-water') packet.waterAnalog = device.calibration.waterWetRaw;
    if (scenario === 'no-echo') { packet.sonarDistanceCm = null; packet.sonarValidSamples = 0; }
    if (scenario === 'recover') Object.assign(packet, { sonarDistanceCm: 10, waterAnalog: device.calibration.waterDryRaw,
      rainAnalog: device.calibration.rainDryRaw, rainDigital: device.calibration.rainActiveLow ? 1 : 0 });
    res.json(ingest(packet, { ...device, simulationOffline: false }, 'simulation'));
  });
  app.get('/api/reports/summary.csv', (req, res) => {
    const state = snapshot();
    const cell = value => { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
    const rows = [['Colony', 'Neighborhood', 'Recorded cats', 'Confirmed TNVR', 'Needs or unknown TNVR', 'Open tasks', 'Last verified visit', 'Data provenance'],
      ...state.colonies.map(c => [c.name, c.neighborhood, c.catCount, c.tnvrCount, c.catCount - c.tnvrCount, c.openTaskCount, c.lastVisitAt,
        c.demo ? 'fictional demo colony' : 'coordinator-entered colony'])];
    res.type('text/csv').attachment('colony-watch-report.csv').send(rows.map(row => row.map(cell).join(',')).join('\r\n'));
  });
  app.get('/api/research', (req, res) => res.type('text/plain').sendFile(resolve(root, 'docs/COMMUNITY_RESEARCH.md')));
  app.get('/review-notes', (req, res) => res.type('text/plain').sendFile(resolve(root, 'docs/BONUS_REVIEW.md')));
  app.get('/source-license', (req, res) => res.type('text/plain').sendFile(resolve(root, 'LICENSE')));
  app.get('/firmware/colony_monitor.ino', (req, res) => res.type('text/plain').attachment('colony_monitor.ino').sendFile(resolve(root, 'firmware/colony_monitor/colony_monitor.ino')));
  app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found' }));
  app.use('/vendor', express.static(resolve(root, 'node_modules/angular'), { index: false }));
  app.use(express.static(resolve(root, clientDirectory)));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    if (status === 500) console.error('Request failed:', error.message);
    res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message });
  });
  return { app, store, monitor, tickDemo };
}
