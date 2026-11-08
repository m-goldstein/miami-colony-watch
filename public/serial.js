import { SerialConnection } from './serial-connection.js';
import { workspacePacket } from './serial-protocol.js';
import { scenarios, demoReading, careState } from './colony-demo.js';
import { ColonyMap } from './colony-map.js';
import { ColonyPlanning } from './colony-planning.js';
import { CareDesk } from './care-desk.js';

const el = id => document.getElementById(id);
const text = (id, value) => { el(id).textContent = value; };
const screens = ['Food reserve', 'Rain surface', 'Standing water', 'Station health'];
const sessionId = () => globalThis.crypto?.randomUUID?.() || `browser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const supported = window.isSecureContext && typeof navigator.serial?.requestPort === 'function';
const history = [], logs = [];
let latest = null, readingCount = 0, invalidCount = 0, firmware = 'waiting', confirmedInterval = null;
let bootId = sessionId(), previousSequence = null, saving = false, startupMessage = '', mode = 'demo';
let workspace = null, catsSignature = '', toastTimer, tourStep = null, visitTarget = null, visitSaving = false;
let careExercise = null;
const demo = { scenario: 'calm', history: [], latest: null, events: [], sequence: 0 };
const colonyMap = new ColonyMap();
const planning = new ColonyPlanning({ notify, onSaved: (colonyId, plan) => {
  if (colonyId === careExercise?.colony.id) { careExercise.preparedness = plan; return; }
  const colony = workspace?.colonies.find(c => c.id === colonyId); if (colony) colony.preparedness = plan;
} });
const careDesk = new CareDesk({ notify, onChange: state => {
  if (careExercise && careExercise.createdAt !== state.createdAt) { demo.history.length = 0; demo.events.length = 0; demo.sequence = 0; tourStep = null; }
  careExercise = state; catsSignature = ''; render();
},
  onStation: scenario => { if (mode === 'demo') applyScenario(scenario, false, false); } });
for (let i = 0; i < 8; i++) {
  const reading = demoReading('calm', demo.sequence++);
  reading.foodPercent += 7 - i; reading.sonarDistanceCm = +(30 - reading.foodPercent * 0.25).toFixed(1);
  demo.history.push({ reading, at: new Date(Date.now() - (7 - i) * 60000).toISOString(), bootId: 'demo-preview' });
}
demo.latest = demo.history[demo.history.length - 1];
demo.events.push({ title: 'Your colony demo is ready', detail: 'Fictional signals. Real care workflows.', at: new Date().toISOString() });
function log(kind, message) {
  logs.unshift({ kind, message: String(message).slice(0, 2048), at: new Date() }); logs.length = Math.min(logs.length, 60);
  el('serial-log').replaceChildren();
  for (const item of logs) {
    const li = document.createElement('li'); li.className = item.kind;
    const time = document.createElement('time'); time.textContent = item.at.toLocaleTimeString();
    const badge = document.createElement('span'); badge.className = 'log-kind'; badge.textContent = item.kind;
    const copy = document.createElement('span'); copy.className = 'log-text'; copy.textContent = item.message;
    li.append(time, badge, copy); el('serial-log').append(li);
  }
}
function notify(message) { text('toast', message); el('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el('toast').hidden = true; }, 4500); }
function liveFresh() { return connection.state === 'connected' && latest && Date.now() - Date.parse(latest.at) < Math.max(5000, (confirmedInterval || 1000) * 3); }
function active() { return mode === 'demo' ? { latest: demo.latest, fresh: scenarios[demo.scenario].online, history: demo.history } : { latest, fresh: !!liveFresh(), history }; }
function selectedStation() { return workspace?.devices.find(d => d.id === el('station-id').value && !d.demo) || null; }
function activeColony() {
  if (mode === 'demo' && careExercise) return { ...careExercise.colony, demo: true, catCount: careExercise.cats.length,
    tnvrCount: careExercise.cats.filter(cat => cat.tnvrStatus === 'confirmed').length, preparedness: careExercise.preparedness };
  return mode === 'demo' ? workspace?.colonies.find(c => c.demo && c.name === 'South Point Park') || workspace?.colonies.find(c => c.demo) : workspace?.colonies.find(c => c.id === selectedStation()?.colonyId);
}
function setMode(value) {
  mode = value; catsSignature = '';
  if (mode === 'live') { tourStep = null; text('connection-message', connection.state === 'connected' ? startupMessage : 'Connect your station for live food, rain, and water readings.'); }
  else el('device-key').value = '';
  render(); drawChart();
}
function applyScenario(key, manual = true, persist = true) {
  if (!scenarios[key]) return;
  if (manual) tourStep = null;
  if (persist) { void careDesk.station(key); return; }
  mode = 'demo'; demo.scenario = key;
  const point = { reading: demoReading(key, demo.sequence++), at: new Date().toISOString(), bootId: 'demo-preview' };
  demo.latest = point; demo.history.push(point); if (demo.history.length > 120) demo.history.shift();
  if (manual) tourStep = null;
  demo.events.unshift({ title: scenarios[key].label, detail: 'Demo scenario · no live device or workspace records changed.', at: point.at });
  demo.events.length = Math.min(12, demo.events.length);
  if (key === 'refill') { document.body.classList.remove('refill-celebration'); void document.body.offsetWidth; document.body.classList.add('refill-celebration'); setTimeout(() => document.body.classList.remove('refill-celebration'), 800); }
  catsSignature = ''; render(); drawChart();
}
function renderCats() {
  const colony = activeColony();
  const fallback = [{ id: 'demo-mango', name: 'Mango', description: 'Orange tabby, a fictional neighbor', tnvrStatus: 'unknown' },
    { id: 'demo-luna', name: 'Luna', description: 'Gray coat, a fictional neighbor', tnvrStatus: 'unknown' },
    { id: 'demo-pepper', name: 'Pepper', description: 'Black coat, a fictional neighbor', tnvrStatus: 'unknown' }];
  const cats = mode === 'demo' && careExercise ? careExercise.cats.slice(0, 3) : colony ? workspace.cats.filter(c => c.colonyId === colony.id).slice(0, 3) : mode === 'demo' ? fallback : [];
  const signature = JSON.stringify([mode, colony?.id, cats]); if (signature === catsSignature) return; catsSignature = signature;
  el('cat-cards').replaceChildren(); el('neighbors-empty').hidden = cats.length > 0;
  text('neighbors-note', mode === 'demo' ? 'Fictional demo cats · illustrated portraits, caregiver records, and TNVR follow-up.' : 'Caregiver-entered records for the linked station · these portraits are illustrations, not identification photos.');
  for (const cat of cats) {
    const card = document.createElement('a'); card.className = 'cat-card'; card.href = '/colonies.html#census'; card.target = '_blank'; card.rel = 'noopener';
    const portrait = document.createElement('span'); portrait.className = 'cat-portrait'; portrait.setAttribute('aria-hidden', 'true');
    const coat = cat.description.toLowerCase();
    portrait.style.color = coat.includes('black') || coat.includes('tuxedo') ? '#64716a' : coat.includes('gray') ? '#a4aea3' : coat.includes('orange') ? '#dca76a' : coat.includes('cream') ? '#dfd0b3' : '#c4a17b';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 100');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#cat-face'); svg.append(use); portrait.append(svg);
    const copy = document.createElement('span'); copy.className = 'cat-copy';
    const name = document.createElement('h3'); name.textContent = cat.name;
    const description = document.createElement('p'); description.textContent = cat.description;
    const badge = document.createElement('small'); badge.textContent = cat.tnvrStatus === 'confirmed' ? 'TNVR record confirmed' : cat.tnvrStatus === 'needed' ? 'TNVR follow-up needed' : 'Identity / TNVR to review';
    copy.append(name, description, badge); const arrow = document.createElement('span'); arrow.className = 'cat-arrow'; arrow.textContent = '↗';
    card.append(portrait, copy, arrow); el('cat-cards').append(card);
  }
}
function renderTimeline() {
  const colony = activeColony();
  const savedDemoVisits = (careExercise?.visits || []).map(v => ({ title: `${v.author} logged a demo visit`, detail: v.notes || `${v.catsSeen} cats observed.`, at: v.createdAt }));
  const events = mode === 'demo' ? [...savedDemoVisits, ...demo.events].sort((a, b) => b.at.localeCompare(a.at)) : (workspace?.visits || []).filter(v => v.colonyId === colony?.id).map(v => ({ title: `${v.author} logged a field visit`, detail: v.notes || `${v.catsSeen} cats observed.`, at: v.createdAt }));
  const list = el('care-timeline'); list.replaceChildren();
  for (const event of (events.length ? events.slice(0, 3) : [{ title: 'A visit makes the picture complete', detail: 'Link a station and record the care you actually provided.', at: null }])) {
    const row = document.createElement('li'), dot = document.createElement('span'); dot.className = 'timeline-dot'; dot.textContent = '✓';
    const copy = document.createElement('span'), title = document.createElement('b'), note = document.createElement('small');
    title.textContent = event.title; note.textContent = event.detail; copy.append(title, note); row.append(dot, copy); list.append(row);
  }
}
function render() {
  const connected = connection.state === 'connected', busy = ['choosing', 'opening', 'closing'].includes(connection.state);
  const current = active(), data = current.fresh ? current.latest?.reading : null, care = careState(data, current.fresh);
  document.body.dataset.mode = mode;
  el('mode-demo').classList.toggle('selected', mode === 'demo'); el('mode-demo').setAttribute('aria-pressed', mode === 'demo');
  el('mode-live').classList.toggle('selected', mode === 'live'); el('mode-live').setAttribute('aria-pressed', mode === 'live');
  el('demo-playground').hidden = mode !== 'demo'; el('support-notice').hidden = mode === 'demo' || supported;
  if (!supported) text('support-notice', !window.isSecureContext ? 'Open this page on localhost or HTTPS to enable USB access. The demo still works.' : 'This browser does not expose Web Serial. Use a supported desktop browser for live Arduino; the demo works here.');
  text('source-label', mode === 'demo' ? 'Interactive demo · fictional data' : liveFresh() ? 'Live Arduino · direct USB readings' : 'Live Arduino · waiting for readings');
  text('source-note', mode === 'demo' ? 'Preview only. Nothing is sent to your station.' : 'No simulated values in live mode.');
  const records = list => workspace?.[list].filter(record => !!record.demo === (mode === 'demo'));
  text('workspace-colonies', records('colonies')?.length ?? '—');
  text('workspace-stations', records('devices')?.length ?? '—');
  text('workspace-scope', workspace ? (mode === 'demo' ? 'Fictional demo records · local workspace' : 'Physical records · local workspace') : 'Local workspace unavailable');
  el('connect').disabled = !supported || connected || busy;
  el('disconnect').disabled = !connected; el('sample').disabled = !connected || mode !== 'live'; el('stream-interval').disabled = busy || mode !== 'live';
  el('download').disabled = !current.history.length;
  el('save-reading').disabled = saving || mode !== 'live' || !liveFresh() || !el('station-id').value || !el('device-key').value.trim();
  el('connection-dot').className = 'connection-dot' + (connected ? ' connected' : busy ? ' busy' : '');
  text('connection-label', { connected: 'USB connected', disconnected: 'Disconnected', choosing: 'Choose a port', opening: 'Opening USB', closing: 'Closing USB' }[connection.state]);
  text('board-version', 'Firmware: ' + firmware); text('confirmed-interval', confirmedInterval ? `Board interval: ${confirmedInterval / 1000}s` : 'Stream interval: unconfirmed');
  const age = latest ? Math.max(0, Math.floor((Date.now() - Date.parse(latest.at)) / 1000)) : null;
  text('last-reading', age === null ? 'No live measurements yet' : `Last live measurement: ${age}s ago${liveFresh() ? '' : ' · not live'}`);
  text('invalid-value', `${invalidCount} rejected live frames`);
  const food = data?.foodPercent, water = data?.waterIndex, wet = data?.rainWet;
  document.body.classList.toggle('raining', wet === true); document.body.classList.toggle('flooding', water != null && water >= 60);
  document.body.classList.toggle('food-low', food != null && food <= 25); document.body.classList.toggle('unknown-food', food == null);
  document.body.classList.toggle('station-offline', !current.fresh); document.body.classList.toggle('station-alert', care.checks > 0 && current.fresh);
  text('food-value', !data ? '—' : food == null ? 'Unknown' : `${food}%`);
  text('food-status', !data ? 'Reading unavailable' : food == null ? 'Check the sensor' : food <= 25 ? 'Time for a top-up' : 'Reserve looking stocked');
  text('food-note', !data ? 'Fresh readings are needed to check the reserve.' : food == null ? 'No reliable echo. Check the hopper before assuming it is empty.' : 'Approximate hopper fill, not food eaten. A person still checks the food.');
  el('food-meter').style.width = `${food || 0}%`; el('food-meter').classList.toggle('warning', food != null && food <= 25);
  const hopperHeight = food == null ? 65 : food * 1.05; el('scene-food-fill').setAttribute('y', 231 - hopperHeight); el('scene-food-fill').setAttribute('height', hopperHeight);
  const bowlHeight = food == null ? 35 : food * .54; el('bowl-fill').setAttribute('y', 81 - bowlHeight); el('bowl-fill').setAttribute('height', bowlHeight);
  text('scene-food-value', food == null ? '?' : `${food}%`);
  text('rain-value', wet === undefined ? '—' : wet ? 'Wet' : 'Dry');
  text('rain-status', wet === undefined ? 'Reading unavailable' : wet ? 'Check the shelter' : 'Plate is dry');
  text('rain-condition', wet === undefined ? 'A fresh plate reading helps plan a shelter check.' : wet ? 'The plate is wet. Check that food and shelter stay protected.' : 'Dry at the plate. Keep regular shelter checks on the plan.');
  text('rain-raw', data ? `Rain plate AO ${data.rainAnalog} · DO ${data.rainDigital ? 'HIGH' : 'LOW'}` : 'Local plate wetness · not a forecast');
  text('water-value', water != null ? `${water} / 100` : '—');
  text('water-status', water == null ? 'Reading unavailable' : water >= 60 ? 'Inspect the base' : 'Below alert level');
  text('water-note', water == null ? 'A fresh probe reading helps identify local standing water.' : water >= 60 ? 'The probe is wet. Check the site when access is safe.' : 'A heads-up if standing water reaches the probe. This is not a flood all-clear.');
  el('water-level').style.height = `${water || 0}%`; el('water-meter').style.width = `${water || 0}%`;
  text('water-raw', data ? `Probe A2: ${data.waterAnalog} · index, not depth` : 'Wetness index · not water depth');
  const colony = activeColony(); text('colony-location', mode === 'demo' ? `${colony?.name || 'South Point Park'} · example colony` : colony ? `${colony.name} · linked station` : 'Your colony · live station');
  text('scene-badge', care.badge); text('care-badge', care.badge.toUpperCase()); text('care-title', care.title); text('care-detail', care.detail);
  el('care').dataset.kind = care.kind;
  text('care-action', mode === 'demo' && care.kind === 'food' ? 'Refill demo hopper →' : mode === 'demo' && care.kind === 'offline' ? 'Restore demo connection →' : care.action + ' →');
  text('scene-caption', mode === 'demo' ? 'Fictional demo · illustrated cats' : 'Illustration reacts to readings · not cat detection');
  text('sonar-value', !data ? '—' : data.sonarDistanceCm === null ? 'No echo' : `${data.sonarDistanceCm.toFixed(1)} cm`);
  text('sonar-quality', data ? `${data.sonarValidSamples} / 5 valid echoes` : 'No current echo samples.');
  Array.from(el('echo-dots').children).forEach((dot, i) => dot.classList.toggle('valid', !!data && i < data.sonarValidSamples));
  text('encoder-value', data?.encoderPosition != null ? data.encoderPosition : '—');
  text('encoder-button', `Button: ${data?.buttonPressed === undefined ? '—' : data.buttonPressed ? 'PRESSED' : 'released'}`);
  text('screen-value', data?.screen !== undefined ? `OLED: ${data.screen + 1}/4 · ${screens[data.screen]}` : 'OLED screen: waiting');
  text('packet-value', mode === 'demo' ? `${demo.history.length} demo samples` : `${readingCount} readings`);
  text('uptime-value', data ? `Board uptime: ${(data.uptimeMs / 60000).toFixed(1)} min${mode === 'demo' ? ' (simulated)' : ''}` : 'Board uptime: —');
  text('sequence-value', data ? `Sequence: ${data.sequence}` : 'Sequence: —');
  document.querySelectorAll('[data-scenario]').forEach(button => { const selected = button.dataset.scenario === demo.scenario; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', selected); });
  el('tour-progress').hidden = tourStep === null;
  if (tourStep !== null) {
    text('tour-step', `${tourStep + 1} / 4`);
    text('tour-description', ['A fictional storm outlook gives the South Point Park team a head start. The Arduino’s low-food signal helps prioritize a refill.', 'The demo reserve is topped up. Now confirm the caregiver, pack supplies, and check the shelter before conditions worsen.', 'The rain plate and station-base probe are wet. These local signals call for a check when official guidance and access allow.', 'Record the care visit and save the colony’s readiness plan below. The next caregiver gets a clear handoff.'][tourStep]);
    text('tour-next', tourStep === 3 ? 'Finish demo ✓' : 'Next moment →');
  }
  renderCats(); renderTimeline(); colonyMap.update(workspace, mode);
  planning.update({ mode, colony, reading: current.latest?.reading, receivedAt: current.latest?.at, fresh: current.fresh,
    planEndpoint: mode === 'demo' && careExercise ? '/api/care-demo/preparedness' : null, planRevision: mode === 'demo' ? careExercise?.createdAt : null });
  text('edge-colony-label', colony?.name || (mode === 'demo' ? 'South Point Park' : 'YOUR LINKED COLONY'));
}
function drawChart() {
  const points = active().history, max = Math.max(40, ...points.map(p => p.reading.sonarDistanceCm || 0)) * 1.05;
  let path = '', gap = true;
  points.forEach((point, i) => { const value = point.reading.sonarDistanceCm; if (value === null) { gap = true; return; }
    path += `${gap ? 'M' : 'L'}${(points.length > 1 ? i * 600 / (points.length - 1) : 0).toFixed(1)} ${(120 - value * 110 / max).toFixed(1)} `; gap = false; });
  el('sonar-path').setAttribute('d', path); text('chart-range', `0–${Math.ceil(max)} CM`);
  text('history-note', mode === 'demo' ? 'Demo headspace history · not measured consumption. These preview readings are never uploaded.' : `${history.length} live readings retained in this tab. Missing echoes remain unknown; this is not a consumption record.`);
}
const connection = new SerialConnection({
  onState: ({ state, message }) => {
    startupMessage = message; text('connection-message', message); log('link', message);
    if (state === 'opening') { latest = null; readingCount = 0; invalidCount = 0; firmware = 'waiting'; confirmedInterval = null; history.length = 0; bootId = sessionId(); previousSequence = null; drawChart(); }
    if (state === 'disconnected') el('device-key').value = '';
    render();
  },
  onFrame: (frame, raw) => {
    if (frame.type === 'event') {
      const event = frame.data; if (event.firmware) firmware = event.firmware;
      if (event.event === 'boot') { bootId = sessionId(); previousSequence = null; latest = null; confirmedInterval = null; }
      if (event.event === 'hello') confirmedInterval = event.telemetryIntervalMs;
      if (event.event === 'stream') confirmedInterval = event.intervalMs;
      log(event.event === 'error' ? 'error' : 'board', raw);
    } else {
      const data = frame.data;
      if (data.sequence === previousSequence) { log('board', `Ignored duplicate frame #${data.sequence}`); return; }
      if (previousSequence !== null && data.sequence < previousSequence) { bootId = sessionId(); log('board', 'Sequence restarted; using a new session identity.'); }
      previousSequence = data.sequence; latest = { reading: data, at: new Date().toISOString(), bootId }; history.push(latest); if (history.length > 120) history.shift();
      readingCount++; log('reading', raw); drawChart(); text('connection-message', 'Receiving live sensor measurements directly over USB.');
      void connection.send('B').catch(error => log('error', error.message));
    }
    render();
  },
  onError: (error, kind) => { if (kind === 'frame') invalidCount++; log('error', error.message); render(); }
});
async function loadWorkspace() {
  const response = await fetch('/api/state', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Local workspace is unavailable; viewing and demo still work.');
  workspace = await response.json(); catsSignature = ''; render(); return workspace;
}
function populateStations() {
  const selected = el('station-id').value, stations = workspace.devices.filter(d => !d.demo && d.lifecycle !== 'retired');
  el('station-id').replaceChildren(new Option(stations.length ? 'Select a physical station' : 'Provision a physical station in the workspace first', ''));
  for (const station of stations) el('station-id').add(new Option(`${station.name} · ${station.id}`, station.id));
  if (stations.some(d => d.id === selected)) el('station-id').value = selected;
  text('save-status', stations.length ? 'Select a station and enter its device key. Live readings only.' : 'Open the field workspace to provision a physical device. Demo stations are excluded.');
  render();
}
function openVisit() {
  const station = selectedStation();
  if (mode === 'live' && !station) {
    el('station-tools').open = true; document.querySelector('.workspace-save').open = true;
    void loadWorkspace().then(populateStations).catch(error => notify(error.message));
    el('station-id').focus(); notify('Choose the physical station so the visit goes to the right colony.'); return;
  }
  visitTarget = { mode, colonyId: station?.colonyId || null };
  text('visit-context', mode === 'demo' ? 'Fictional care visit, saved to the rescue exercise and its dated report. Physical records are unchanged.' : `A real caregiver record for ${activeColony()?.name || 'the linked colony'}. This will not fabricate a sensor reading.`);
  text('visit-submit', mode === 'demo' ? 'Save demo visit' : 'Save field visit');
  el('visit-author').value = mode === 'demo' ? 'Demo caregiver' : '';
  el('visit-cats').value = 0; el('visit-food').checked = false; el('visit-water').checked = false;
  el('visit-notes').value = ''; el('visit-error').hidden = true;
  el('visit-dialog').showModal(); el('visit-author').focus();
}

el('mode-demo').addEventListener('click', () => setMode('demo'));
el('mode-live').addEventListener('click', () => setMode('live'));
document.querySelectorAll('.mobile-menu a').forEach(link => {
  link.addEventListener('click', () => { link.closest('details').open = false; });
});
el('refresh-map').addEventListener('click', async () => {
  el('refresh-map').disabled = true; text('map-fetch-status', 'Refreshing saved colony records…');
  try { await loadWorkspace(); text('map-fetch-status', 'Saved records refreshed. The USB panel is unchanged.'); }
  catch (error) { text('map-fetch-status', error.message); }
  finally { el('refresh-map').disabled = false; }
});
el('connect').addEventListener('click', () => {
  setMode('live'); // Synchronous: preserve the browser click's port-chooser activation.
  void connection.connect(Number(el('stream-interval').value)).catch(error => { log('error', error.message); text('connection-message', `${startupMessage} ${error.message}`); });
});
el('disconnect').addEventListener('click', () => { void connection.disconnect(); });
el('sample').addEventListener('click', () => { if (mode === 'live') void connection.send('SAMPLE').then(() => log('sent', 'SAMPLE')).catch(error => log('error', error.message)); });
el('stream-interval').addEventListener('change', () => { if (mode === 'live' && connection.state === 'connected') void connection.setIntervalMs(Number(el('stream-interval').value)).catch(error => log('error', error.message)); });
document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => applyScenario(button.dataset.scenario)));
el('start-tour').addEventListener('click', () => { tourStep = 0; applyScenario('food', false); planning.setScenario('storm'); el('demo-playground').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
el('tour-close').addEventListener('click', () => { tourStep = null; render(); });
el('tour-next').addEventListener('click', () => {
  if (tourStep === 0) { tourStep = 1; applyScenario('refill', false); }
  else if (tourStep === 1) { tourStep = 2; applyScenario('water', false); }
  else if (tourStep === 2) { tourStep = 3; render(); openVisit(); }
  else { tourStep = null; render(); notify('From a station signal to a shared care record. That’s the idea.'); }
});
el('care-action').addEventListener('click', () => {
  const a = active(), care = careState(a.latest?.reading, a.fresh);
  if (mode === 'demo' && care.kind === 'food') { applyScenario('refill', tourStep === null); notify('Demo reserve topped up. A care visit is still worth recording.'); }
  else if (mode === 'demo' && care.kind === 'offline') { applyScenario('calm'); notify('Demo connection restored. Live hardware was not changed.'); }
  else openVisit();
});
el('log-visit').addEventListener('click', openVisit);
for (const id of ['visit-close', 'visit-cancel']) el(id).addEventListener('click', () => { if (!visitSaving) el('visit-dialog').close(); });
el('visit-form').addEventListener('submit', async event => {
  event.preventDefault(); if (visitSaving || !visitTarget) return;
  const body = { author: el('visit-author').value.trim(), catsSeen: Number(el('visit-cats').value), foodRefilled: el('visit-food').checked,
    waterChanged: el('visit-water').checked, notes: el('visit-notes').value.trim() };
  if (!body.author) return;
  visitSaving = true; el('visit-submit').disabled = true;
  try {
    if (visitTarget.mode === 'demo') {
      await careDesk.recordVisit(body);
      if (tourStep === 3) tourStep = null;
      notify('Demo visit saved to the rescue exercise and report. Sensor evidence stays unchanged.');
    } else {
      const response = await fetch('/api/visits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, colonyId: visitTarget.colonyId }), signal: AbortSignal.timeout(5000) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'The visit could not be saved');
      workspace.visits.unshift(result); notify('Care visit saved to the colony workspace. Thank you for showing up.');
    }
    el('visit-dialog').close(); render();
  } catch (error) { text('visit-error', error.message); el('visit-error').hidden = false; }
  finally { visitSaving = false; el('visit-submit').disabled = false; }
});
el('clear-log').addEventListener('click', () => { logs.length = 0; el('serial-log').replaceChildren(); });
el('download').addEventListener('click', () => {
  const points = active().history, source = mode === 'demo' ? 'demo-preview' : 'hardware';
  const blob = new Blob(points.map(item => JSON.stringify({ ...item.reading, receivedAt: item.at, bootId: item.bootId, source }) + '\n'), { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url;
  a.download = `colony-${mode === 'demo' ? 'demo-preview' : 'sensor-readings'}-${new Date().toISOString().slice(0, 10)}.jsonl`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
el('load-stations').addEventListener('click', () => { text('save-status', 'Loading physical station records…'); void loadWorkspace().then(populateStations).catch(error => text('save-status', error.message)); });
el('station-id').addEventListener('change', () => { catsSignature = ''; render(); }); el('device-key').addEventListener('input', render);
el('save-reading').addEventListener('click', async () => {
  if (mode !== 'live' || !liveFresh() || saving) return;
  const deviceId = el('station-id').value, key = el('device-key').value.trim(), reading = latest;
  if (!deviceId || !key) return;
  saving = true; render(); text('save-status', 'Saving the selected measurement…');
  try {
    const response = await fetch('/api/readings', { method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(workspacePacket(reading.reading, deviceId, reading.bootId, reading.at)) });
    const result = await response.json(); if (!response.ok || !result.accepted) throw new Error(result.error || 'The workspace did not acknowledge the reading');
    text('save-status', result.duplicate ? 'This reading was already saved. No duplicate record created.' : 'Saved to the colony workspace. Tasks and dashboard will update.');
    log('saved', `${deviceId} · sequence ${reading.reading.sequence}${result.duplicate ? ' (already stored)' : ''}`);
    void loadWorkspace().catch(() => {});
    if (connection.state === 'connected') await connection.send('A');
  } catch (error) { text('save-status', `Not saved: ${error.message}. Live USB readings continue.`); }
  finally { saving = false; render(); }
});
window.addEventListener('pagehide', () => { el('device-key').value = ''; void connection.disconnect(); });
setInterval(render, 1000);
render(); drawChart();
void loadWorkspace().catch(() => {});
