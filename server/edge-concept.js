import { id, text, number, fail } from './domain.js';
import { VISIT_GAP_MS, DOSE_COOLDOWN_MS } from '../public/edge-concept-model.js';
export { conceptSummary, VISIT_GAP_MS, DOSE_COOLDOWN_MS } from '../public/edge-concept-model.js';

const TAGS = Object.freeze({ mango: 'demo-chip-mango', luna: 'demo-chip-luna', unlinked: 'demo-chip-unlinked' });
export function initialEdgeConcept(createdAt) {
  return { version: 1, simulated: true, clockMs: Date.parse(createdAt), reads: [], sessions: [], portions: [], events: [],
    bindings: { 'demo-chip-mango': { catId: 'example-cat-1', reviewer: 'Fictional baseline association' }, 'demo-chip-luna': { catId: 'example-cat-2', reviewer: 'Fictional baseline association' } },
    dispenser: { fault: null, lastDoseAt: null },
    climate: { scenario: 'calm', humidityPercent: 56, temperatureC: 26, simulated: true },
    wireless: { mode: 'ble', hubOnline: true, nextSequence: 0, packets: [], lastBatch: [] } };
}

// This is a persisted design simulator. It never uses Serial, GPIO, a motor, or a network radio.
export function applyEdgeConcept(state, body) {
  const c = state.edgeConcept, action = body.action;
  c.clockMs = Math.max(c.clockMs, Date.now());
  const at = () => new Date(c.clockMs).toISOString();
  const record = (kind, detail) => { c.events.push({ id: id('concept-event'), kind, at: at(), ...detail }); };
  const queue = (kind, payload) => {
    const packet = { id: id('concept-packet'), nodeId: 'CONCEPT-SOUTH-POINT-01', bootId: 'design-exercise-v1', sequence: c.wireless.nextSequence++,
      kind, payload, sampledAt: at(), simulated: true, ackedAt: null };
    c.wireless.packets.push(packet); return packet;
  };
  if (c.events.length >= 1000) fail('Reset the fictional exercise before adding more concept events', 409);
  if (action === 'read') {
    if (typeof body.tag !== 'string' || !Object.hasOwn(TAGS, body.tag)) fail('Choose a fictional chip association');
    if (body.returnAfterGap !== undefined && typeof body.returnAfterGap !== 'boolean') fail('Invalid visit-return scenario');
    if (body.returnAfterGap) c.clockMs += 180000;
    const token = TAGS[body.tag], previous = c.sessions.findLast(session => session.token === token);
    const repeated = previous && c.clockMs - Date.parse(previous.lastReadAt) < VISIT_GAP_MS;
    const session = repeated ? previous : { id: id('concept-visit'), token, firstReadAt: at(), lastReadAt: at(), readCount: 0 };
    if (!repeated) c.sessions.push(session);
    session.lastReadAt = at(); session.readCount++;
    const reading = { id: id('concept-read'), token, sessionId: session.id, at: at(), repeated: !!repeated };
    c.reads.push(reading); queue('rfid-read', reading); record('rfid-read', { title: repeated ? 'Repeated read grouped into the existing visit' : 'A new tagged visit session', sourceId: reading.id });
  } else if (action === 'link') {
    const token = TAGS.unlinked, catId = text(body.catId, 'cat identity', 80), reviewer = text(body.reviewer, 'reviewer', 70);
    if (!c.sessions.some(session => session.token === token)) fail('Simulate an unlinked chip first', 409);
    if (!state.cats.some(cat => cat.id === catId)) fail('Choose a cat already in this exercise', 404);
    if (c.bindings[token]) fail('This example chip association was already reviewed', 409);
    c.bindings[token] = { catId, reviewer, linkedAt: at() };
    record('chip-linked', { title: 'A caregiver linked the example chip to an existing identity', catId, reviewer });
  } else if (action === 'dispense') {
    const requestId = text(body.requestId, 'portion request identity', 80);
    if (c.portions.some(portion => portion.requestId === requestId)) return;
    const targetGrams = number(body.targetGrams, 'portion target', 5, 30, true);
    if (c.dispenser.fault) fail('Jam latched. Record a manual inspection before previewing another gate cycle.', 409);
    if (c.dispenser.lastDoseAt != null && c.clockMs - c.dispenser.lastDoseAt < DOSE_COOLDOWN_MS) fail('The 30-second demo cooldown is active. Advance the concept clock before another cycle.', 409);
    const portion = { id: id('concept-portion'), requestId, targetGrams, measuredGrams: null, at: at(), status: 'simulated-cycle', physicalActuation: false };
    c.portions.push(portion); c.dispenser.lastDoseAt = c.clockMs;
    queue('portion-request', portion); record('gate-cycle', { title: `Gate cycle simulated for a ${targetGrams} g target; delivered amount unverified`, sourceId: portion.id });
  } else if (action === 'jam') {
    c.dispenser.fault = 'jam'; record('jam', { title: 'Simulated jam: motor power would be inhibited; no automatic retry' });
  } else if (action === 'inspect') {
    const reviewer = text(body.reviewer, 'inspection reviewer', 70);
    c.dispenser.fault = null; record('manual-inspection', { title: 'Manual inspection recorded in the exercise', reviewer });
  } else if (action === 'advance') {
    c.clockMs += 60000; record('clock-advanced', { title: 'Concept clock advanced by one minute' });
  } else if (action === 'climate') {
    const climates = { calm: [56, 26], rain: [83, 24], humid: [92, 29] };
    if (!Object.hasOwn(climates, body.scenario)) fail('Choose a supported simulated climate');
    const [humidityPercent, temperatureC] = climates[body.scenario];
    c.climate = { scenario: body.scenario, humidityPercent, temperatureC, simulated: true };
    queue('climate-preview', { ...c.climate });
    record('climate-preview', { title: `Proposed climate probe: ${humidityPercent}% RH, ${temperatureC}°C · simulated ${body.scenario}` });
  } else if (action === 'wireless') {
    if (!['wifi', 'ble', 'lora'].includes(body.mode) || typeof body.hubOnline !== 'boolean') fail('Choose a radio mode and hub state');
    c.wireless.mode = body.mode; c.wireless.hubOnline = body.hubOnline;
    record('radio-configured', { title: `${body.mode.toUpperCase()} concept path · hub ${body.hubOnline ? 'available' : 'offline'}` });
  } else if (action === 'sync') {
    if (!c.wireless.hubOnline) fail('The simulated hub is offline. Events stay queued locally.', 409);
    const pending = c.wireless.packets.filter(packet => !packet.ackedAt);
    c.wireless.lastBatch = pending.map(packet => packet.id); pending.forEach(packet => { packet.ackedAt = at(); });
    record('hub-sync', { title: `${pending.length} concept packets acknowledged once; no real wireless transmission`, count: pending.length });
  } else if (action === 'replay') {
    if (!c.wireless.hubOnline) fail('The simulated hub is offline. The previous acknowledgements are retained.', 409);
    record('hub-replay', { title: `${c.wireless.lastBatch.length} prior packet identities replayed; acknowledged total unchanged` });
  } else fail('Choose a supported concept action');
}
