import { DEFAULT_BUILD, PRESETS, SOURCES, RESEARCH_DATE, estimateBuild, compareScale, money } from './manufacturing-model.js';

const el = id => document.getElementById(id);
const element = (tag, content, className) => { const item = document.createElement(tag); if (content != null) item.textContent = content; if (className) item.className = className; return item; };
const form = el('build-form'), storageKey = 'colony-watch-manufacturing-v1';
let estimate = null;
const parts = {
  controller: { kicker: '01 · THE LOCAL COORDINATOR', title: 'ESP32-S3, with Wi-Fi and BLE.', description: 'A single controller handles serial sensors, local rules, an event journal and a choice of uplink. Use a module to simplify the RF design, with its antenna area kept clear.', specs: { Interface: 'I²C climate probe · UART sonar / LF reader · SPI optional LoRa · servo PWM + analog feedback', 'Board target': '85 × 65 mm, two-layer carrier; exact GPIO and routing are not released.', Budget: '$3.50 module allowance; Wi-Fi and Bluetooth LE already included.' }, source: 'espRadio' },
  climate: { kicker: '02 · FOOD AND ATMOSPHERIC CONDITIONS', title: 'Listen to the feeding corner.', description: 'A protected ultrasonic sensor estimates food-bin headroom. A thermally isolated SHTC3 on a small ventilated probe measures temperature and relative humidity. Keep it away from board heat and splashes.', specs: { Connections: '3.3 V I²C climate probe · UART sonar · replaceable wetness inputs', Calibration: 'Empty / full bin geometry, sonar blind zone, probe placement and sensor quality flags.', 'Current Arduino': 'Temperature works today. Humidity belongs to this proposed board, not the current firmware.' }, source: 'sht' },
  rfid: { kicker: '03 · UNIQUE LINKED VISITORS', title: 'An animal-chip reader, not NFC.', description: 'A separate ISO 11784/11785 LF reader connects by UART to a tuned external coil. It supplies an identifier when a compatible implanted chip passes close enough. A caregiver associates it with an existing cat.', specs: { Protocol: '134.2 kHz FDX-B animal chips; the reference module also supports HDX. Verify legacy-chip compatibility.', Placement: 'Open, protected neck-height coil. Tune with the final housing and validate orientation / interference.', Counting: 'Raw reads → quiet-gap visit sessions → distinct reviewed identities. No remote location or registry lookup.' }, source: 'rfidData' },
  actuator: { kicker: '04 · LOCAL AND BOUNDED', title: 'Feedback on a guarded food gate.', description: 'A separate servo rail drives a short, bounded movement. Position feedback can identify an unexpected gate position; motor power is inhibited after a fault until a manual inspection.', specs: { Control: 'Maximum run time, cooldown, requested dose ceiling and latched fault in proposed firmware.', Mechanics: 'Covered moving parts and spring-biased closure to test under realistic food loads.', Evidence: 'Servo angle is not delivered grams. Calibrate with the intended kibble or add a load cell.' }, source: 'servo' },
  power: { kicker: '05 · POWER WITHOUT SURPRISES', title: 'Separate rails, one protected input.', description: 'The reference LF reader needs 5.5–15 V, so the carrier begins with a protected 12 V supply. A 5 V buck feeds the servo, and clean 3.3 V supplies the controller and low-voltage sensors.', specs: { Protection: 'Fuse / reverse-polarity / transient protection allowances, output switching and test points.', 'Size from measurements': 'Budget servo stall current plus reader / radio peaks; verify decoupling and brownout recovery.', Scope: 'External wired supply included as an allowance. Optional solar power adds a solar panel, charge controller and battery, sized for measured energy use and local sunlight. Solar hardware, batteries and runtime analysis are budgeted separately.' }, source: 'rfidData' },
  radio: { kicker: '06 · SHARE THE BACKHAUL', title: 'Start on-board. Extend when needed.', description: 'Use ESP32 Wi-Fi where an access point exists, or Bluetooth LE to a nearby powered hub. An optional SPI SX1262 module adds point-to-point LoRa for small, infrequent packets.', specs: { Cost: 'No separate BLE module. Optional LoRa adds the radio, antenna and an allocated shared hub.', Hub: 'A powered ESP32-class bridge with existing internet backhaul. No cellular modem or SIM in this estimate.', Validation: 'Region-appropriate antenna / band, permissions, packet airtime, encryption and a measured site link budget.' }, source: 'lora' }
};
function showPart(key) {
  const part = parts[key];
  const position = { controller: [39, 30], climate: [70, 22], rfid: [20, 27], actuator: [65, 76], power: [26, 62], radio: [60, 61] }[key];
  const board = document.querySelector('.board-canvas'); board.dataset.focus = key;
  board.style.setProperty('--part-x', `${position[0]}%`); board.style.setProperty('--part-y', `${position[1]}%`);
  for (const button of document.querySelectorAll('[data-board-part]')) button.setAttribute('aria-pressed', String(button.dataset.boardPart === key));
  for (const button of document.querySelectorAll('[data-pcb-zone]')) button.setAttribute('aria-pressed', String(button.dataset.pcbZone === key));
  el('part-kicker').textContent = part.kicker; el('part-title').textContent = part.title; el('part-description').textContent = part.description;
  el('part-specs').replaceChildren();
  for (const [label, value] of Object.entries(part.specs)) el('part-specs').append(element('dt', label), element('dd', value));
  el('part-source').href = SOURCES[part.source].url; el('part-source').textContent = `${SOURCES[part.source].name} ↗`;
}
const radios = {
  wifi: { title: 'Use the infrastructure already there.', description: 'The ESP32 already includes Wi-Fi. Budget no extra node radio or new hub when a permitted 2.4 GHz access point and internet backhaul already exist. Store readings locally during outages. Coverage, credentials and ongoing network costs still need a site agreement.', source: 'espRadio' },
  ble: { title: 'A nearby bridge for several small stations.', description: 'Bluetooth LE is also built into the ESP32. A powered phone or ESP32-class bridge can forward observations to the care desk. This model allows $35 per new bridge, shared across a user-defined number of stations. Automatic background phone collection is proposed, not implemented; coverage and operating-system behavior need testing.', source: 'espRadio' },
  lora: { title: 'Short packets. One shared uplink.', description: 'Add an SX1262 module and appropriate antenna to each node. The estimate uses a $60 point-to-point hub allowance with a compatible radio and existing internet backhaul. This is not a LoRaWAN concentrator or a cellular gateway. Use a region-appropriate module (for example, US915 in the US), validate airtime and range on site, and send telemetry rather than images.', source: 'lora' }
};
function showRadio(key) {
  const radio = radios[key];
  for (const button of document.querySelectorAll('[data-radio-view]')) button.setAttribute('aria-pressed', String(button.dataset.radioView === key));
  const link = element('a', `${SOURCES[radio.source].name} ↗`); link.href = SOURCES[radio.source].url;
  el('radio-description').replaceChildren(element('h3', radio.title), element('p', radio.description), link);
}
function fillForm(config) {
  for (const key of Object.keys(DEFAULT_BUILD)) { const input = form.elements.namedItem(key); if (input.type === 'checkbox') input.checked = config[key]; else input.value = config[key]; }
}
function readForm() {
  const config = {};
  for (const key of Object.keys(DEFAULT_BUILD)) { const input = form.elements.namedItem(key); config[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? input.valueAsNumber : input.value; }
  return config;
}
const priceRow = (label, basis, unit, total, group) => {
  const tr = element('tr'), description = element('td', label);
  if (group) description.append(element('small', group));
  tr.append(description, basis, element('td', money(unit)), element('td', money(total))); return tr;
};
function allocations(e) {
  return [
    { label: 'Batch setup / stencil', unit: e.setupPerUnit, total: e.config.setup },
    { label: 'Batch freight', unit: e.freightPerUnit, total: e.config.freight },
    { label: 'New shared hubs', unit: e.hubTotal / e.config.quantity, total: e.hubTotal },
    { label: `Build contingency · ${e.config.contingency}%`, unit: e.contingencyPerUnit, total: e.contingencyPerUnit * e.config.quantity },
    { label: 'One-time design budget allocation', unit: e.developmentPerUnit, total: e.config.development }
  ];
}
function render() {
  const config = readForm(); estimate = form.checkValidity() ? estimateBuild(config) : null;
  for (const button of document.querySelectorAll('[data-preset]')) button.setAttribute('aria-pressed', String(Object.entries(PRESETS[button.dataset.preset]).every(([key, value]) => key === 'label' || config[key] === value)));
  el('build-hub-size').disabled = config.radio === 'wifi'; form.elements.existingHub.disabled = config.radio === 'wifi';
  el('download-bom').disabled = !estimate; el('download-brief').disabled = !estimate;
  const status = el('estimate-status'); status.dataset.invalid = String(!estimate);
  if (!estimate) {
    status.textContent = 'Enter a valid whole station count (1–10,000), hub group (1–100), and non-negative budget assumptions. Totals are unavailable until corrected.';
    for (const id of ['estimate-unit', 'estimate-board', 'estimate-batch']) el(id).textContent = '—';
    el('estimate-unit-note').textContent = 'Correct the highlighted assumptions to calculate';
    for (const id of ['cost-bars', 'bom-body', 'bom-footer']) el(id).replaceChildren();
    el('estimate-hubs').textContent = ''; el('estimate-recurring').textContent = '';
    el('scale-cards').replaceChildren(); el('lean-savings').textContent = 'Correct the budget inputs to compare builds.'; return;
  }
  const e = estimate, qty = e.config.quantity;
  el('estimate-unit').textContent = money(e.unitTotal); el('estimate-board').textContent = money(e.boardUnit); el('estimate-batch').textContent = money(e.batchTotal);
  el('estimate-unit-note').textContent = `Per station at ${qty.toLocaleString()} units · includes ${money(e.developmentPerUnit)} allocated design budget + ${e.config.contingency}% build contingency`;
  el('estimate-hubs').textContent = e.hubCount ? `${e.hubCount} new shared ${e.config.radio === 'ble' ? 'BLE' : 'point-to-point LoRa'} hubs × ${money(e.hubUnit)} = ${money(e.hubTotal)} per batch. The final partial group still needs a whole hub.` : config.radio === 'wifi' ? 'Wi-Fi uses existing access points / backhaul; no new hub purchase is budgeted.' : 'Compatible, already-owned hubs selected; no new hub purchase is budgeted.';
  el('estimate-recurring').textContent = `Build + setup + freight + hub allocation: ${money(e.recurringBuildUnit)} / node before contingency and one-time design. Ongoing operations and exclusions below remain separate.`;
  el('estimate-exclusions').textContent = e.exclusion;
  const lean = estimateBuild({ ...config, ...PRESETS.sense }), care = estimateBuild({ ...config, ...PRESETS.care });
  el('lean-savings').textContent = `At ${qty.toLocaleString()} stations, the sensing-first build is ${money(lean.unitTotal)} / station, ${money(care.unitTotal - lean.unitTotal)} less than the visit-reader + food-gate build with BLE hubs under these assumptions. Add those modules where the care team needs them.`;
  el('scale-cards').replaceChildren();
  for (const scaled of compareScale(config)) {
    const card = element('article', null, 'scale-card');
    card.dataset.selected = String(scaled.config.quantity === qty);
    card.append(element('span', `${scaled.config.quantity.toLocaleString()} stations`), element('strong', money(scaled.unitTotal)), element('small', 'per station · allocated estimate'),
      element('p', `${money(scaled.developmentPerUnit)} design budget / station · ${scaled.hubCount} new hubs`));
    const choose = element('button', 'Use this batch ↗', 'text-link'); choose.type = 'button';
    choose.addEventListener('click', () => { form.elements.quantity.value = scaled.config.quantity; render(); }); card.append(choose); el('scale-cards').append(card);
  }
  el('cost-bars').replaceChildren();
  for (const group of e.groups) {
    const row = element('div', null, 'cost-bar'), track = element('div', null, 'cost-bar-track'), fill = element('i');
    fill.style.width = `${100 * group.amount / e.unitTotal}%`; track.append(fill); track.setAttribute('aria-hidden', 'true');
    row.append(element('span', group.name), element('b', money(group.amount)), track); el('cost-bars').append(row);
  }
  el('bom-caption').textContent = `BOM · ${qty.toLocaleString()} stations · ${config.radio.toUpperCase()} · USD · references ${RESEARCH_DATE}`;
  el('bom-body').replaceChildren();
  for (const line of e.lines) {
    const basis = element('td', line.basis);
    if (line.source) { const a = element('a', ' Reference ↗'); a.href = SOURCES[line.source].url; basis.append(a); }
    el('bom-body').append(priceRow(line.label, basis, line.unit, line.extended, line.group));
  }
  el('bom-footer').replaceChildren();
  for (const item of allocations(e)) el('bom-footer').append(priceRow(item.label, element('td', 'Planning allowance / allocation'), item.unit, item.total));
  el('bom-footer').append(priceRow('Complete planning total', element('td', 'Includes allocations; exclusions below'), e.unitTotal, e.batchTotal));
  try { localStorage.setItem(storageKey, JSON.stringify(config)); } catch { /* Private browsing can disable storage. */ }
  status.textContent = `Updated estimate for ${qty.toLocaleString()} stations. All figures are planning estimates in USD.`;
}
function download(content, mime, filename) {
  const link = element('a'); link.href = URL.createObjectURL(new Blob([content], { type: mime })); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
function downloadBOM() {
  if (!estimate) return;
  const e = estimate, rows = [
    ['ColonyWatch Rev A design estimate · simulated hardware concept'], ['Reference date', RESEARCH_DATE], ['Currency', 'USD'],
    ...Object.entries(e.config).map(([key, value]) => ['Assumption', key, value]), [],
    ['Part / process', 'Category', 'Quantity', 'USD per node (unrounded)', 'Batch USD (unrounded)', 'Price basis', 'Source']
  ];
  rows.push(...e.lines.map(line => [line.label, line.group, e.config.quantity, line.unit, line.extended, line.basis, line.source ? SOURCES[line.source].url : 'Engineering allowance']));
  rows.push(...allocations(e).map(item => [item.label, 'Batch allocation', e.config.quantity, item.unit, item.total, 'Planning allowance / allocation', '']));
  rows.push(['COMPLETE TOTAL', '', e.config.quantity, e.unitTotal, e.batchTotal], ['Controller PCBA subtotal only', '', e.config.quantity, e.boardUnit, e.boardUnit * e.config.quantity], [], ['Exclusions', e.exclusion], ['Status', 'Mock PCB illustration. No Gerbers or validated hardware. Not a supplier quote.']);
  download('\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8', 'colony-watch-manufacturing-bom.csv');
}
function downloadBrief() {
  if (!estimate) return;
  download(JSON.stringify({ title: 'ColonyWatch Rev A edge-node design study', generatedAt: new Date().toISOString(), referenceDate: RESEARCH_DATE, currency: 'USD',
    status: 'Concept only; not a released PCB, validated feeder or supplier quote.', ...estimate,
    artifacts: ['edge-node-pcb.svg', 'edge-node-system.svg', 'edge-node-feeder.svg', 'edge-node-network.svg'].map(file => `/assets/${file}`),
    currentHardware: 'Arduino DHT11 temperature path is preserved; current firmware reports no humidity. RFID, servo and radio are simulated.',
    nextSteps: ['Bench-verify chip formats and antenna read zone', 'Size supply and servo driver from measured peak current', 'Create schematic, routed PCB and test fixture', 'Validate food calibration, guarding and power-loss behavior', 'Quote manufacturing and supervise a field pilot'], sources: SOURCES
  }, null, 2), 'application/json', 'colony-watch-build-brief.json');
}
form.addEventListener('submit', event => event.preventDefault()); form.addEventListener('input', render); form.addEventListener('change', render);
for (const button of document.querySelectorAll('[data-board-part]')) button.addEventListener('click', () => showPart(button.dataset.boardPart));
for (const button of document.querySelectorAll('[data-pcb-zone]')) button.addEventListener('click', () => showPart(button.dataset.pcbZone));
for (const button of document.querySelectorAll('[data-radio-view]')) button.addEventListener('click', () => showRadio(button.dataset.radioView));
for (const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click', () => { fillForm({ ...readForm(), ...PRESETS[button.dataset.preset] }); showRadio(PRESETS[button.dataset.preset].radio); render(); });
for (const button of document.querySelectorAll('[data-quantity]')) button.addEventListener('click', () => { form.elements.quantity.value = button.dataset.quantity; render(); });
el('reset-build').addEventListener('click', () => { fillForm(DEFAULT_BUILD); showRadio(DEFAULT_BUILD.radio); render(); });
el('use-lean-build').addEventListener('click', () => { fillForm({ ...readForm(), ...PRESETS.sense }); showRadio('wifi'); render(); });
const motionButton = el('board-motion'), motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const setBoardMotion = paused => { document.body.classList.toggle('board-motion-paused', paused); motionButton.setAttribute('aria-pressed', String(paused)); motionButton.textContent = paused ? 'Play board motion' : 'Pause board motion'; };
setBoardMotion(motionPreference.matches); motionPreference.addEventListener('change', event => setBoardMotion(event.matches));
motionButton.addEventListener('click', () => setBoardMotion(motionButton.getAttribute('aria-pressed') !== 'true'));
el('print-build').addEventListener('click', () => window.print()); el('download-bom').addEventListener('click', downloadBOM); el('download-brief').addEventListener('click', downloadBrief);
let initial = DEFAULT_BUILD;
try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved && estimateBuild(saved)) initial = { ...DEFAULT_BUILD, ...saved }; } catch { /* Ignore invalid saved browser preferences. */ }
fillForm(initial); showPart('controller'); showRadio(initial.radio); render();
el('source-list').replaceChildren();
for (const source of Object.values(SOURCES)) { const li = element('li'), a = element('a', source.name + ' ↗'); a.href = source.url; li.append(a, element('p', source.note)); el('source-list').append(li); }
