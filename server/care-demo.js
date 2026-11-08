import { Router } from 'express';
import { id, text, number, fail } from './domain.js';
import { scenarios } from '../public/colony-demo.js';
import { temperatureState, TEMPERATURE_ALERTS } from '../public/temperature.js';
import { initialEdgeConcept, applyEdgeConcept } from './edge-concept.js';

const DEMO_ID = 'south-point-exercise-v1';
const photo = '/assets/miami-community-cat.png';
const stamp = () => new Date().toISOString();
const day = () => stamp().slice(0, 10);
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const event = (state, kind, detail = {}, occurredAt = stamp()) => {
  const record = { id: id('evidence'), kind, occurredAt, ...detail };
  state.events.push(record); return record;
};

export function initialCareDemo() {
  const createdAt = stamp();
  const names = ['Mango', 'Luna', 'Pepper', 'Coco', 'Miso', 'Sol', 'Olive', 'Cleo', 'Biscuit', 'Fern', 'Sunny', 'Harbor', 'Nori', 'Pippa'];
  return { id: DEMO_ID, version: 3, demo: true, createdAt, importedAt: null, edgeConcept: initialEdgeConcept(createdAt),
    colony: { id: 'example-south-point', name: 'South Point Park', neighborhood: 'South Beach', caretaker: 'Elena',
      note: 'Fictional exercise. No real colony location or caregiver contact details.' },
    cats: names.map((name, i) => ({ id: `example-cat-${i + 1}`, name, aliases: [],
      description: i === 0 ? 'Brown tabby, white chin' : i === 13 ? 'Calico, small build, white front paws' : ['Black coat, green eyes', 'Gray tabby, white chest', 'Orange tabby, white paws'][i % 3],
      tnvrStatus: i < 11 ? 'confirmed' : 'unknown', tnvrEvidence: i < 11 ? 'Fictional baseline record predating this exercise; no new procedure claimed.' : '',
      lastSeenAt: null, observations: [], photo: i === 0 ? photo : null })),
    updates: [], tasks: [], visits: [], events: [],
    station: { id: 'EXAMPLE-UNO-01', colonyId: 'example-south-point', scenario: 'calm', online: true, foodPercent: 72, wet: false, waterIndex: 6, temperatureC: 26, receivedAt: createdAt, source: 'fictional Arduino scenario' },
    readings: [], pilot: { equipment: '', enclosure: '', power: '', gateway: '', monthly: '', maintenance: '', notes: '' } };
}

function sampleBatch() {
  const at = stamp();
  return [
    { id: 'morning-01', kind: 'photo', author: 'Elena', observedAt: at, text: 'Mango at South Point Park. Brown tabby with the white chin by the covered feeding corner. Photo attached.', attachment: photo,
      suggestedCatId: 'example-cat-1', suggestedName: 'Mango', suggestedDescription: 'Brown tabby, white chin', suggestedAction: 'existing', concern: null },
    { id: 'morning-02', kind: 'photo', author: 'Marco', observedAt: at, text: 'Saw “Stripey” at the same feeding corner. Brown tabby, white chin. Could this be Mango? Please check before adding another cat.', attachment: photo,
      suggestedCatId: 'example-cat-1', suggestedName: 'Stripey', suggestedDescription: 'Brown tabby, white chin', suggestedAction: 'existing', concern: null },
    { id: 'morning-03', kind: 'message', author: 'Lucía', observedAt: at, text: 'Pippa, the small calico with white front paws, was favoring her front paw today. Can an experienced caregiver review her at South Point Park?',
      suggestedCatId: 'example-cat-14', suggestedName: 'Pippa', suggestedDescription: 'Calico, small build, white front paws', suggestedAction: 'existing', concern: 'care',
      followUp: 'Arrange an experienced caregiver check for Pippa', severity: 'urgent' },
    { id: 'morning-04', kind: 'message', author: 'Nico', observedAt: at, text: 'A small black-and-white juvenile I don’t recognize near the feeding corner at South Point Park. Calling them Pebble for now. Please review identity and TNVR needs.',
      suggestedName: 'Pebble', suggestedDescription: 'Black-and-white juvenile, dark patch over left eye', suggestedAction: 'new', concern: 'identity', severity: 'warning' },
    { id: 'morning-05', kind: 'location', author: 'Marco', observedAt: at, text: 'South Point Park handoff: use the usual public path when access is permitted. The backup feeder should check the covered station before the wet spell. Schematic location note only.',
      suggestedAction: 'colony', concern: 'shelter', followUp: 'Confirm the backup feeder and covered shelter check', severity: 'warning' },
    { id: 'morning-06', kind: 'document', author: 'Elena', observedAt: at, text: 'Fictional clinic note SP-014: Pippa’s sterilization, vaccination, and return were documented today. Coordinator: verify this example record before updating TNVR.',
      suggestedCatId: 'example-cat-14', suggestedName: 'Pippa', suggestedAction: 'procedure', concern: null, documentRef: 'FICTIONAL-SP-014' }
  ].map(record => ({ ...record, status: 'pending', provenance: 'Fictional sample batch', receivedAt: at }));
}

function addTask(state, fields) {
  const existing = state.tasks.find(task => task.sourceId === fields.sourceId && task.type === fields.type && task.status !== 'completed');
  if (existing) return existing;
  const task = { id: id('followup'), colonyId: state.colony.id, status: 'open', assignee: '', createdAt: stamp(), updatedAt: stamp(), dueAt: '', ...fields };
  state.tasks.push(task); event(state, 'task_created', { taskId: task.id, sourceId: task.sourceId, title: task.title }); return task;
}

export function careReport(state, from, to) {
  if (!validDay(from) || !validDay(to) || from > to) fail('Choose a valid report date range');
  const inPeriod = at => at && at.slice(0, 10) >= from && at.slice(0, 10) <= to;
  const evidence = state.events.filter(record => inPeriod(record.occurredAt));
  const sightings = state.updates.filter(update => update.status === 'reviewed' && update.catId && update.decision !== 'procedure' && inPeriod(update.observedAt));
  const procedures = evidence.filter(record => record.kind === 'procedure_recorded');
  return { from, to, generatedAt: stamp(), colony: state.colony.name, demo: true,
    current: { cats: state.cats.length, confirmedTnvr: state.cats.filter(cat => cat.tnvrStatus === 'confirmed').length,
      pendingUpdates: state.updates.filter(update => update.status === 'pending').length, openTasks: state.tasks.filter(task => task.status !== 'completed').length },
    period: { sightings: sightings.length, uniqueCatsObserved: new Set(sightings.map(update => update.catId)).size,
      procedures: procedures.length, visits: state.visits.filter(visit => inPeriod(visit.createdAt)).length,
      completedFollowups: state.tasks.filter(task => task.status === 'completed' && inPeriod(task.completedAt)).length },
    evidence, disclaimer: 'Fictional demonstration records. Current census totals are separate from dated activity. No animal-welfare or time-saved outcomes are inferred.' };
}

export function careDemoRouter(store, enabled) {
  const router = Router();
  router.use((req, res, next) => { if (!enabled) return res.status(403).json({ error: 'The fictional rescue exercise is disabled in hardware-only mode.' }); next(); });
  const load = () => {
    let state = store.get('care_demo', DEMO_ID);
    if (!state) state = store.put('care_demo', initialCareDemo());
    if (state.version < 2) {
      // Keep reviews and historical evidence; an older sample has no temperature measurement.
      if (!Object.hasOwn(state.station, 'temperatureC')) state.station.temperatureC = null;
      for (const reading of state.readings) if (!Object.hasOwn(reading, 'temperatureC')) reading.temperatureC = null;
      state.version = 2; store.put('care_demo', state);
    }
    if (state.version < 3) { state.edgeConcept ||= initialEdgeConcept(state.createdAt); state.version = 3; store.put('care_demo', state); }
    return state;
  };
  const change = work => store.transaction(() => { const state = load(); work(state); store.put('care_demo', state); return state; });
  const find = (state, collection, recordId) => { const record = state[collection].find(item => item.id === recordId); if (!record) fail('Exercise record not found', 404); return record; };
  router.get('/', (req, res) => res.json(load()));
  router.post('/import', (req, res) => res.json(change(state => {
    if (state.importedAt) return;
    state.importedAt = stamp(); state.updates.push(...sampleBatch());
    event(state, 'batch_imported', { title: 'Six fictional field updates received', count: 6 });
  })));
  router.post('/concept', (req, res) => res.json(change(state => applyEdgeConcept(state, req.body))));
  router.post('/updates', (req, res) => res.status(201).json(change(state => {
    if (state.updates.length >= 150) fail('Reset the fictional exercise before adding more updates', 409);
    const update = { id: id('phone-note'), kind: 'message', author: text(req.body.author, 'caregiver', 70),
      text: text(req.body.text, 'field update', 1500), observedAt: stamp(), receivedAt: stamp(),
      status: 'pending', provenance: 'Fictional phone form', suggestedAction: 'existing', concern: req.body.needsCare === true ? 'care' : null,
      followUp: req.body.needsCare === true ? 'Review the caregiver’s field concern' : null, severity: 'warning' };
    state.updates.push(update); event(state, 'update_received', { sourceId: update.id, title: 'Phone update received for review' });
  })));
  router.post('/updates/:id/review', (req, res) => res.json(change(state => {
    const update = find(state, 'updates', req.params.id), body = req.body;
    if (update.status !== 'pending') fail('This update has already been reviewed. Refresh to see its record.', 409);
    const reviewer = text(body.reviewer, 'reviewer', 70), decision = body.decision;
    if (!['existing', 'new', 'colony', 'procedure', 'dismiss'].includes(decision)) fail('Choose a review decision');
    let cat;
    if (decision === 'existing' || decision === 'procedure') cat = find(state, 'cats', text(body.catId, 'cat identity', 80));
    if (decision === 'new') {
      const name = text(body.name, 'cat name', 70), normalized = name.toLowerCase();
      if (state.cats.some(item => [item.name, ...item.aliases].some(alias => alias.toLowerCase() === normalized))) fail('That name or alias already exists. Link the existing identity or review the match.', 409);
      cat = { id: id('example-cat'), name, aliases: [], description: text(body.description, 'distinctive markings', 300),
        tnvrStatus: 'unknown', tnvrEvidence: '', lastSeenAt: update.observedAt, observations: [], photo: update.attachment || null };
      state.cats.push(cat);
    }
    const note = text(body.note || '', 'review evidence', 1000, false);
    if (decision === 'dismiss' && !note) fail('Explain why this update is being dismissed');
    if (decision === 'procedure') {
      if (cat.tnvrStatus === 'confirmed') fail('This cat already has confirmed TNVR. No new completion will be counted.', 409);
      const procedureDate = text(body.procedureDate, 'procedure date', 10), reference = text(body.reference, 'clinic record reference', 120);
      if (!validDay(procedureDate) || procedureDate > day()) fail('Choose a procedure date on or before today');
      if (!note) fail('Record what evidence you checked before confirming TNVR');
      cat.tnvrStatus = 'confirmed'; cat.tnvrEvidence = note; cat.procedureDate = procedureDate; cat.recordRef = reference;
      event(state, 'procedure_recorded', { catId: cat.id, sourceId: update.id, title: `Verified TNVR record: ${cat.name}`, reviewer, reference, note, recordedAt: stamp() }, `${procedureDate}T12:00:00.000Z`);
    }
    if (decision === 'existing') {
      const alias = text(body.alias || '', 'alias', 70, false);
      if (alias && alias.toLowerCase() !== cat.name.toLowerCase() && !cat.aliases.some(item => item.toLowerCase() === alias.toLowerCase())) {
        if (state.cats.some(item => item.id !== cat.id && [item.name, ...item.aliases].some(name => name.toLowerCase() === alias.toLowerCase()))) fail('This alias belongs to another identity; leave it unresolved for review.', 409);
        cat.aliases.push(alias);
      }
    }
    if (cat) { cat.observations.push(update.id); if (decision !== 'procedure') cat.lastSeenAt = update.observedAt; }
    Object.assign(update, { status: decision === 'dismiss' ? 'dismissed' : 'reviewed', decision, catId: cat?.id || null, reviewer, reviewNote: note, reviewedAt: stamp() });
    const record = event(state, 'update_reviewed', { sourceId: update.id, catId: cat?.id || null, title: `${reviewer} ${decision === 'dismiss' ? 'dismissed' : 'reviewed'} ${update.author}’s update`, decision, reviewer, note });
    update.evidenceId = record.id;
    if (decision !== 'dismiss' && decision !== 'procedure' && (update.concern || decision === 'new')) {
      addTask(state, { type: decision === 'new' ? 'identity' : update.concern, sourceId: update.id, catId: cat?.id || null,
        title: decision === 'new' ? `Review identity and TNVR needs: ${cat.name}` : update.followUp || 'Review the field concern', severity: update.severity || 'warning', origin: 'caregiver update' });
    }
  })));
  router.patch('/tasks/:id', (req, res) => res.json(change(state => {
    const task = find(state, 'tasks', req.params.id), body = req.body;
    if (task.status === 'completed') fail('This follow-up is already complete; its evidence is retained.', 409);
    const status = body.status, assignee = text(body.assignee, 'assigned caregiver', 70), note = text(body.note || '', 'visit outcome', 1500, false);
    if (!['assigned', 'completed'].includes(status)) fail('Choose assigned or completed');
    const dueAt = text(body.dueAt || '', 'check-in time', 40, false);
    if (dueAt && !Number.isFinite(Date.parse(dueAt))) fail('Choose a valid check-in time');
    const at = stamp(); Object.assign(task, { status, assignee, dueAt, updatedAt: at });
    event(state, status === 'completed' ? 'task_completed' : 'task_assigned', { taskId: task.id, sourceId: task.sourceId, catId: task.catId || null, title: task.title, assignee, note });
    if (status === 'completed') {
      if (!note) fail('Record what happened before completing the follow-up');
      const catsSeen = number(body.catsSeen, 'cats actually seen', 0, 500, true);
      const visit = { id: id('example-visit'), taskId: task.id, author: assignee, notes: note, catsSeen,
        foodRefilled: body.foodRefilled === true, waterChanged: body.waterChanged === true, createdAt: at };
      state.visits.push(visit); Object.assign(task, { completedAt: at, resolution: note, visitId: visit.id });
      event(state, 'visit_recorded', { taskId: task.id, visitId: visit.id, sourceId: task.sourceId, title: `${assignee} recorded a care visit`, note, catsSeen });
    }
  })));
  router.post('/station', (req, res) => res.json(change(state => {
    const scenario = req.body.scenario;
    if (!Object.hasOwn(scenarios, scenario)) fail('Choose a station scenario');
    if (state.readings.length >= 500) fail('Reset the fictional exercise before recording more sample readings', 409);
    const spec = scenarios[scenario];
    const reading = { ...state.station, scenario, receivedAt: stamp(), id: id('example-reading'), online: spec.online,
      foodPercent: spec.food, wet: spec.rain, waterIndex: spec.water, temperatureC: spec.temperatureC ?? 26 };
    state.station = reading; state.readings.push(reading);
    const record = event(state, 'sensor_reading', { sourceId: reading.id, title: `Arduino exercise: ${scenario}`, reading: { ...reading } });
    const temperature = temperatureState(reading.temperatureC), thermalAlert = TEMPERATURE_ALERTS[temperature];
    if (reading.online && thermalAlert) addTask(state, { type: `temperature-${temperature}`, sourceId: `station:temperature-${temperature}`,
      evidenceId: record.id, title: thermalAlert.title, detail: thermalAlert.detail,
      severity: ['hot', 'freezing'].includes(temperature) ? 'urgent' : 'warning', origin: 'Arduino exercise' });
    else if (!['refill', 'calm'].includes(scenario)) addTask(state, { type: scenario === 'food' ? 'food' : ['rain', 'water'].includes(scenario) ? 'shelter' : 'connection', sourceId: `station:${scenario}`,
      evidenceId: record.id, title: scenario === 'food' ? 'Refill the reserve and inspect the hopper' : ['rain', 'water'].includes(scenario) ? 'Check the shelter and station base when access is safe' : 'Check the station connection',
      severity: scenario === 'food' ? 'urgent' : 'warning', origin: 'Arduino exercise' });
  })));
  router.post('/visits', (req, res) => res.status(201).json(change(state => {
    const body = req.body, visit = { id: id('example-visit'), author: text(body.author, 'caregiver', 70),
      catsSeen: number(body.catsSeen, 'cats actually seen', 0, 500, true), notes: text(body.notes || '', 'visit notes', 1500, false),
      foodRefilled: body.foodRefilled === true, waterChanged: body.waterChanged === true, createdAt: stamp() };
    state.visits.push(visit); event(state, 'visit_recorded', { visitId: visit.id, title: `${visit.author} recorded a care visit`, note: visit.notes, catsSeen: visit.catsSeen });
  })));
  router.patch('/preparedness', (req, res) => res.json(change(state => {
    const body = req.body, checklist = {};
    for (const key of ['backup', 'supplies', 'shelter', 'access', 'records']) {
      if (typeof body.checklist?.[key] !== 'boolean') fail('Complete the preparedness checklist fields');
      checklist[key] = body.checklist[key];
    }
    state.preparedness = { checklist, lead: text(body.lead, 'care lead', 70, false), backup: text(body.backup, 'backup caregiver', 70, false),
      checkIn: text(body.checkIn, 'next check-in', 70, false), notes: text(body.notes, 'handoff notes', 1500, false),
      cats: number(body.cats, 'cats to plan for', 0, 500, true), days: number(body.days, 'supply days', 1, 14, true),
      grams: number(body.grams, 'daily food per cat', 1, 1000), onHandKg: number(body.onHandKg, 'packed food', 0, 1000), updatedAt: stamp() };
  }).preparedness));
  router.patch('/pilot', (req, res) => res.json(change(state => {
    const pilot = {};
    for (const key of ['equipment', 'enclosure', 'power', 'gateway', 'monthly']) {
      const value = req.body[key];
      pilot[key] = value === '' ? '' : number(value, `${key} budget`, 0, 100000);
    }
    pilot.maintenance = text(req.body.maintenance || '', 'maintenance owner', 70, false);
    pilot.notes = text(req.body.notes || '', 'pilot assumptions', 1000, false); state.pilot = pilot;
  })));
  router.get('/report', (req, res) => res.json(careReport(load(), req.query.from, req.query.to)));
  router.get('/report.csv', (req, res) => {
    const state = load(), report = careReport(state, req.query.from, req.query.to);
    const cell = value => { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
    const rows = [['Colony', report.colony], ['Provenance', 'Fictional rescue exercise'], ['Period', `${report.from} through ${report.to}`],
      ['CURRENT CENSUS'], ...Object.entries(report.current), ['DATED ACTIVITY'], ...Object.entries(report.period),
      ['EVIDENCE ID', 'WHEN', 'KIND', 'SOURCE ID', 'CAT ID', 'DETAIL', 'REVIEWER / CAREGIVER', 'REFERENCE', 'RECORDED AT', 'EVIDENCE NOTE', 'AMBIENT TEMPERATURE C'],
      ...report.evidence.map(item => [item.id, item.occurredAt, item.kind, item.sourceId, item.catId, item.title, item.reviewer || item.assignee, item.reference, item.recordedAt || item.occurredAt, item.note, item.reading?.online ? item.reading.temperatureC : null]),
      ['ORIGINAL SOURCE ID', 'OBSERVED AT', 'KIND', 'AUTHOR', 'ORIGINAL WORDS', 'ATTACHMENT', 'REVIEW STATUS', 'LINKED CAT', 'REVIEW NOTE'],
      ...state.updates.filter(update => report.evidence.some(item => item.sourceId === update.id) || (update.observedAt.slice(0, 10) >= report.from && update.observedAt.slice(0, 10) <= report.to))
        .map(update => [update.id, update.observedAt, update.kind, update.author, update.text, update.attachment, update.status, update.catId, update.reviewNote]),
      ['LIMITATION', report.disclaimer]];
    res.type('text/csv').attachment('south-point-care-evidence.csv').send(rows.map(row => row.map(cell).join(',')).join('\r\n'));
  });
  router.post('/reset', (req, res) => {
    if (req.body.confirm !== 'reset-fictional-exercise') fail('Confirm the fictional exercise reset');
    res.json(store.put('care_demo', initialCareDemo()));
  });
  return router;
}
