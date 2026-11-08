const el = id => document.getElementById(id);
const put = (id, value) => { el(id).textContent = value; };
export const outlookScenarios = {
  everyday: { title: 'A good day to keep a good routine.', description: 'Illustrative three-day outlook · everyday care, with room to plan.',
    periods: [['Today', 'Mostly sunny', 20], ['Tomorrow', 'A few clouds', 25], ['Day three', 'Passing showers', 35]],
    steps: [['Next visit', 'Check the reserve, refresh drinking water, and inspect the shelter.'], ['Between visits', 'Keep a backup caregiver and a supply plan ready.'], ['Keep the picture complete', 'Record the cats actually seen and any care follow-up.']] },
  rain: { title: 'A rainy stretch. A head start.', description: 'Illustrative three-day outlook · a chance to prepare before a wet spell.',
    periods: [['Today', 'Passing showers', 40], ['Tomorrow', 'Rain likely', 75], ['Day three', 'Showers easing', 45]],
    steps: [['Before the rain', 'Check the covered food reserve and pack dry supplies.'], ['At the next safe visit', 'Inspect shelter protection and the station base.'], ['Keep someone in the loop', 'Agree on a backup caregiver and the next check-in.']] },
  storm: { title: 'A storm on the horizon. A plan today.', description: 'Fictional storm exercise · these are planning stages, not a real forecast.',
    periods: [['Prepare', 'Confirm the team', null], ['Before weather', 'Secure supplies', null], ['After conditions ease', 'Check in safely', null]],
    steps: [['Prepare together', 'Confirm the backup caregiver and pack sealed food and water.'], ['Before conditions worsen', 'Check shelter placement and agree when to pause site visits.'], ['After official guidance allows', 'Arrange a site check and reconcile the cats with their care records.']] }
};
export function supplyEstimate(cats, days, grams, onHandKg) {
  if (![cats, days, grams, onHandKg].every(Number.isFinite) || cats < 0 || cats > 500 || !Number.isInteger(cats) || days < 1 || days > 14 || !Number.isInteger(days) || grams < 1 || grams > 1000 || onHandKg < 0 || onHandKg > 1000) return null;
  const totalKg = Math.round(cats * days * grams) / 1000;
  return { totalKg, gapKg: Math.max(0, Math.round((totalKg - onHandKg) * 1000) / 1000) };
}
export const checklistLabels = {
  backup: 'Backup caregiver confirmed', supplies: 'Dry food and clean water packed', shelter: 'Shelter and feeding station checked',
  access: 'Access and check-in plan agreed', records: 'Cat identities and records up to date'
};
const kg = value => `${value.toFixed(2)} kg`;
export class ColonyPlanning {
  constructor({ onSaved, notify }) {
    this.onSaved = onSaved; this.notify = notify; this.mode = 'demo'; this.scenario = 'rain'; this.weather = null; this.context = null; this.key = null; this.dirty = false; this.revision = 0;
    this.form = el('preparedness-form');
    this.form.addEventListener('input', () => { this.dirty = true; this.revision++; put('plan-save-status', 'Unsaved changes · save to keep them with this colony.'); this.renderFormSummary(); });
    this.form.addEventListener('submit', event => { event.preventDefault(); void this.save(); });
    // Action buttons inside the plan are explicitly non-submit buttons in the HTML.
    el('download-brief').addEventListener('click', () => this.download());
    el('refresh-outlook').addEventListener('click', () => { void this.loadWeather(); });
    document.querySelectorAll('[data-outlook]').forEach(button => button.addEventListener('click', () => this.setScenario(button.dataset.outlook)));
    this.renderOutlook(); this.renderFormSummary();
  }
  update(context) {
    this.context = context;
    if (this.mode !== context.mode) { this.mode = context.mode; this.renderOutlook(); }
    const colony = context.colony, key = `${context.mode}:${colony?.id || 'unlinked'}`;
    const canSave = !!colony;
    el('save-plan').disabled = !canSave || !!this.saving;
    put('focus-name', colony?.name || (context.mode === 'demo' ? 'South Point Park' : 'Link your colony station'));
    put('focus-provenance', context.mode === 'demo' ? '· FICTIONAL PILOT' : '· PHYSICAL COLONY');
    put('focus-area', colony ? `${colony.neighborhood} · ${context.mode === 'demo' ? 'example records, not a verified deployment' : 'caregiver-entered colony record'}` : context.mode === 'demo' ? 'South Beach, Miami · fictional example colony' : 'Choose a physical station in the device tools to link its colony.');
    put('focus-cats', colony?.catCount ?? '—'); put('focus-tnvr', colony?.tnvrCount ?? '—');
    put('plan-context', colony ? `Saved in the local workspace for ${colony.name}${colony.demo ? ' · fictional demo plan' : ''}.` : 'Link a physical colony to save its care plan. You can still draft and download a brief.');
    if (this.key !== key) {
      this.key = key; this.dirty = false;
      const p = colony?.preparedness || {};
      for (const name of Object.keys(checklistLabels)) this.form.elements[name].checked = p.checklist?.[name] === true;
      for (const [id, value] of Object.entries({ 'plan-cats': p.cats ?? colony?.catCount ?? 14, 'plan-days': p.days ?? 3,
        'plan-grams': p.grams ?? 60, 'plan-on-hand': p.onHandKg ?? 0, 'plan-lead': p.lead ?? colony?.caretaker ?? '',
        'plan-backup': p.backup ?? '', 'plan-check-in': p.checkIn ?? '', 'plan-notes': p.notes ?? '' })) el(id).value = value;
      put('plan-save-status', p.updatedAt ? `Saved ${new Date(p.updatedAt).toLocaleString()} · local colony record` : canSave ? 'Changes stay in this form until you save.' : 'Choose a physical station in the device tools to save a plan.');
      this.renderFormSummary();
    }
  }
  readForm() {
    return { checklist: Object.fromEntries(Object.keys(checklistLabels).map(key => [key, this.form.elements[key].checked])),
      cats: el('plan-cats').valueAsNumber, days: el('plan-days').valueAsNumber, grams: el('plan-grams').valueAsNumber, onHandKg: el('plan-on-hand').valueAsNumber,
      lead: el('plan-lead').value.trim(), backup: el('plan-backup').value.trim(), checkIn: el('plan-check-in').value.trim(), notes: el('plan-notes').value.trim() };
  }
  renderFormSummary() {
    const p = this.readForm(), count = Object.values(p.checklist).filter(Boolean).length;
    put('readiness-count', `${count} / 5`); el('readiness-fill').style.width = `${count * 20}%`;
    const estimate = supplyEstimate(p.cats, p.days, p.grams, p.onHandKg);
    put('supply-total', estimate ? kg(estimate.totalKg) : '—');
    put('supply-gap', estimate ? estimate.gapKg > 0 ? `${kg(estimate.gapKg)} still to pack` : 'Packing target covered ✓' : 'Enter valid quantities above.');
    el('supply-gap').classList.toggle('packed', estimate?.gapKg === 0);
  }
  setScenario(key) {
    if (!outlookScenarios[key] || this.mode !== 'demo') return;
    this.scenario = key; this.weather = null; this.renderOutlook();
  }
  renderOutlook() {
    const live = this.weather, scenario = outlookScenarios[this.scenario], demo = this.mode === 'demo';
    el('outlook-scenarios').hidden = !demo;
    document.querySelectorAll('[data-outlook]').forEach(button => { const selected = !live && this.scenario === button.dataset.outlook; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', selected); });
    put('outlook-source', live ? 'NATIONAL WEATHER SERVICE · SOUTH BEACH AREA' : demo ? 'ILLUSTRATIVE OUTLOOK · NOT LIVE WEATHER' : 'NWS AREA OUTLOOK · NOT LOADED');
    put('outlook-heading', live ? 'The area outlook, from NWS.' : demo ? scenario.title : 'A little context beyond the sensors.');
    put('outlook-description', live ? `Forecast issued ${new Date(live.updatedAt).toLocaleString()}. Retrieved ${new Date(live.retrievedAt).toLocaleTimeString()}.` : demo ? scenario.description : 'Load the South Beach area forecast. It is separate from your connected Arduino and may not cover another colony.');
    const periods = live ? live.periods.map(p => [p.name, p.summary, p.rainChance, `${p.temperature}°${p.temperatureUnit} · ${p.wind}`]) : demo ? scenario.periods : [];
    el('forecast-periods').replaceChildren();
    for (const [name, summary, rain, detail] of periods) {
      const card = document.createElement('div'), label = document.createElement('span'), symbol = document.createElement('span'), title = document.createElement('b'), note = document.createElement('small');
      label.textContent = name; symbol.className = 'forecast-symbol'; symbol.textContent = rain != null && rain >= 40 ? '☂' : rain == null ? '♡' : '☀';
      title.textContent = rain == null ? summary : `${rain}% rain`; note.textContent = detail || (rain == null ? 'Planning stage' : summary);
      card.append(label, symbol, title, note); el('forecast-periods').append(card);
    }
    el('outlook-alerts').hidden = !live;
    put('outlook-alerts', live ? !live.alertsAvailable ? 'Alert feed unavailable. Check NWS Miami for current alerts.' : live.alerts.length ? live.alerts.map(a => a.headline || a.event).join(' · ') : 'NWS returned no active alerts for this area at retrieval. Check again before travel.' : '');
    const steps = live || !demo ? outlookScenarios.rain.steps : scenario.steps;
    put('ahead-title', !live && demo && this.scenario === 'storm' ? 'A shared plan beats a scramble.' : 'Make the next visit count.');
    el('ahead-steps').replaceChildren();
    for (const [index, [title, description]] of steps.entries()) {
      const item = document.createElement('li'), number = document.createElement('span'), copy = document.createElement('div'), heading = document.createElement('b'), note = document.createElement('p');
      number.textContent = String(index + 1).padStart(2, '0'); heading.textContent = title; note.textContent = description; copy.append(heading, note); item.append(number, copy); el('ahead-steps').append(item);
    }
    if (!this.loading) put('outlook-status', live ? (Date.now() - Date.parse(live.updatedAt) > 12 * 3600000 ? 'This forecast was issued over 12 hours ago; check NWS for updates.' : 'Area weather data does not establish safe access to the colony.') : demo ? 'Demo outlooks never change or complete your saved care checklist.' : 'No forecast has been loaded. Sensor readings remain available above.');
  }
  async loadWeather() {
    if (this.loading) return;
    this.loading = true; el('refresh-outlook').disabled = true; put('outlook-status', 'Getting the South Beach area outlook from NWS…');
    try {
      const response = await fetch('/api/weather/south-point', { signal: AbortSignal.timeout(18000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The outlook could not be loaded.');
      this.weather = result; this.loading = false; this.renderOutlook();
    } catch (error) { put('outlook-status', `Could not refresh the NWS outlook. ${this.weather ? 'The previous retrieval remains displayed.' : this.mode === 'demo' ? 'The illustrative demo remains displayed.' : 'No area forecast is available here.'} Check NWS Miami for current conditions.`); }
    finally { this.loading = false; el('refresh-outlook').disabled = false; }
  }
  async save() {
    const colony = this.context?.colony;
    if (!colony || this.saving || !this.form.reportValidity()) return;
    this.saving = true; el('save-plan').disabled = true; put('plan-save-status', 'Saving the colony care plan…');
    const submittedKey = this.key, submittedRevision = this.revision, body = this.readForm();
    try {
      const response = await fetch(`/api/colonies/${encodeURIComponent(colony.id)}/preparedness`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Plan could not be saved.');
      colony.preparedness = result; this.onSaved(colony.id, result);
      if (this.key === submittedKey && this.revision === submittedRevision) { this.dirty = false; put('plan-save-status', `Saved ${new Date(result.updatedAt).toLocaleTimeString()} · ${colony.name}${colony.demo ? ' demo plan' : ''}`); }
      else if (this.key === submittedKey) put('plan-save-status', 'Earlier changes saved. Your newest edits still need saving.');
      this.notify(`Care plan saved for ${colony.name}.`);
    } catch (error) { if (this.key === submittedKey) put('plan-save-status', `Not saved: ${error.message}. Your draft is still in the form.`); }
    finally { this.saving = false; el('save-plan').disabled = !this.context?.colony; }
  }
  download() {
    if (!this.form.reportValidity()) return;
    const p = this.readForm(), c = this.context, estimate = supplyEstimate(p.cats, p.days, p.grams, p.onHandKg), r = c?.fresh ? c.reading : null;
    const lines = ['COLONY WATCH · CARE HANDOFF', c?.colony?.name || 'Unlinked colony draft', `Created: ${new Date().toLocaleString()}`,
      `Records: ${c?.mode === 'demo' ? 'Fictional demo colony' : 'Physical colony'} · ${this.dirty ? 'Includes unsaved form changes' : 'Current form'}`,
      '', 'STATION SNAPSHOT', `Source: ${c?.mode === 'demo' ? 'Illustrative Arduino scenario' : 'Direct USB Arduino'} · received: ${c?.receivedAt || 'unavailable'}`,
      `Food reserve: ${r?.foodPercent == null ? 'Unknown' : r.foodPercent + '% (approximate hopper fill)'}`,
      `Rain plate: ${r ? r.rainWet ? 'Wet' : 'Dry' : 'Unknown'}`, `Station-base wetness index: ${r?.waterIndex ?? 'Unknown'} (not flood depth)`,
      '', 'AREA OUTLOOK', this.weather ? `NWS South Beach area · issued ${this.weather.updatedAt} · retrieved ${this.weather.retrievedAt}` : c?.mode === 'demo' ? `Illustrative exercise: ${outlookScenarios[this.scenario].title} · NOT a live forecast` : 'Not loaded',
      ...(this.weather ? this.weather.periods.map(period => `${period.name}: ${period.summary}`) : []),
      ...(this.weather ? [this.weather.alertsAvailable ? `Alerts at retrieval: ${this.weather.alerts.map(a => a.headline || a.event).join('; ') || 'none returned'}` : 'Alert feed unavailable'] : []),
      'Check current official weather and access guidance: https://www.weather.gov/mfl/', '', 'PEOPLE & CHECK-IN',
      `Care lead: ${p.lead || 'Not assigned'}`, `Backup caregiver: ${p.backup || 'Not assigned'}`, `Next check-in: ${p.checkIn || 'Not agreed'}`, `Handoff: ${p.notes || 'Not recorded'}`,
      '', 'READINESS', ...Object.entries(checklistLabels).map(([key, label]) => `[${p.checklist[key] ? 'x' : ' '}] ${label}`),
      '', 'DRY FOOD PACKING PLAN', `${p.cats} cats × ${p.days} days × ${p.grams} g per cat per day`, `Target: ${kg(estimate.totalKg)} · packed: ${kg(p.onHandKg)} · remaining: ${kg(estimate.gapKg)}`,
      'Use your food feeding guide and care plan. Fill percentage is not food weight.', '', 'Cat disaster preparation: https://www.alleycat.org/community-cat-care/be-prepared-for-disasters/'
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })), link = document.createElement('a');
    link.href = url; link.download = `colony-care-brief-${new Date().toISOString().slice(0, 10)}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
