import { conceptSummary } from './edge-concept-model.js';
import { habitatMarkup } from './habitat-scene.js';
const el = id => document.getElementById(id);
const put = (id, value) => { el(id).textContent = value; };
const node = (tag, className, content) => { const element = document.createElement(tag); if (className) element.className = className; if (content != null) element.textContent = content; return element; };
const time = at => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
export class EdgeConceptUI {
  constructor({ act, notify }) {
    this.act = act; this.notify = notify; this.state = null; this.pending = false; this.lastAttempt = null;
    el('habitat').innerHTML = habitatMarkup;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.setMotion(this.reducedMotion.matches);
    this.reducedMotion.addEventListener('change', event => this.setMotion(event.matches));
    el('habitat-motion').addEventListener('click', () => this.setMotion(el('habitat-motion').getAttribute('aria-pressed') !== 'true'));
    el('habitat-read').addEventListener('click', () => { void this.send({ action: 'read', tag: 'mango' }); });
    el('habitat-feed').addEventListener('click', () => {
      this.lastAttempt ||= { requestId: crypto.randomUUID(), targetGrams: 10 };
      void this.send({ action: 'dispense', ...this.lastAttempt }).then(ok => { if (ok) this.lastAttempt = null; });
    });
    el('habitat-offline').addEventListener('click', () => { if (this.state) void this.send({ action: 'wireless', mode: this.state.edgeConcept.wireless.mode, hubOnline: !this.state.edgeConcept.wireless.hubOnline }); });
    for (const button of document.querySelectorAll('[data-habitat-weather]')) button.addEventListener('click', () => { void this.send({ action: 'climate', scenario: button.dataset.habitatWeather }); });
    el('concept-read').addEventListener('click', () => { void this.send({ action: 'read', tag: el('concept-tag').value }); });
    el('concept-return').addEventListener('click', () => { void this.send({ action: 'read', tag: el('concept-tag').value, returnAfterGap: true }); });
    el('concept-link-form').addEventListener('submit', event => { event.preventDefault(); void this.send({ action: 'link', catId: el('concept-link-cat').value, reviewer: el('concept-link-author').value.trim() }); });
    el('concept-portion-form').addEventListener('submit', event => {
      event.preventDefault(); const targetGrams = el('concept-portion-grams').valueAsNumber;
      if (!this.lastAttempt || this.lastAttempt.targetGrams !== targetGrams) this.lastAttempt = { requestId: crypto.randomUUID(), targetGrams };
      void this.send({ action: 'dispense', ...this.lastAttempt }).then(ok => { if (ok) this.lastAttempt = null; });
    });
    el('concept-jam').addEventListener('click', () => { void this.send({ action: 'jam' }); });
    el('concept-inspect').addEventListener('click', () => { void this.send({ action: 'inspect', reviewer: 'Fictional demo inspector' }); });
    el('concept-advance').addEventListener('click', () => { void this.send({ action: 'advance' }); });
    for (const id of ['concept-radio', 'concept-hub-online']) el(id).addEventListener('change', () => { void this.send({ action: 'wireless', mode: el('concept-radio').value, hubOnline: el('concept-hub-online').checked }); });
    el('concept-sync').addEventListener('click', () => { void this.send({ action: 'sync' }); });
    el('concept-replay').addEventListener('click', () => { void this.send({ action: 'replay' }); });
  }
  async send(body) {
    if (this.pending || !this.state) return false;
    this.pending = true; this.buttons(); put('concept-status', 'Saving the simulated device event…');
    try {
      await this.act(body); put('concept-status', 'Concept event saved. No physical reader, dispenser or radio was operated.');
      const c = this.state.edgeConcept;
      const messages = { read: c.reads.at(-1)?.repeated ? 'Another antenna read, the same visit. No extra visitor was counted.' : 'A visitor passed the loop. The saved visit follows the reviewed chip identity.',
        dispense: 'Gate cycle previewed. The target is illustrative; delivered food is unmeasured.', climate: `${c.climate?.humidityPercent}% RH simulated. Shelter, airflow and water still need a caregiver check.`,
        wireless: c.wireless.hubOnline ? 'Hub available again. Sync the saved queue from the wireless tile below.' : 'Hub offline. The local event queue keeps the next observations.',
        jam: 'Jam simulated. The gate stays inhibited until a mock inspection is recorded.', inspect: 'Mock inspection recorded. The normal cooldown still applies.', sync: 'Queued packet identities acknowledged once.', replay: 'Replayed packets keep their original identity. No double count.' };
      put('habitat-status', messages[body.action] || 'Simulated event saved in the station log.');
      clearTimeout(this.animationTimer); const scene = el('habitat-scene'); scene.dataset.action = '';
      void scene.getBoundingClientRect(); scene.dataset.action = body.action;
      this.animationTimer = setTimeout(() => { scene.dataset.action = ''; }, 2600);
      return true;
    } catch (error) { put('concept-status', error.message); put('habitat-status', error.message); return false; }
    finally { this.pending = false; this.buttons(); }
  }
  buttons() {
    document.querySelectorAll('#future-station button:not(#habitat-motion)').forEach(button => { button.disabled = this.pending || !this.state; });
    if (this.state?.edgeConcept.dispenser.fault) { el('concept-dispense').disabled = true; el('habitat-feed').disabled = true; }
  }
  setMotion(paused) {
    el('habitat-scene').classList.toggle('motion-paused', paused);
    el('habitat-motion').setAttribute('aria-pressed', String(paused));
    put('habitat-motion', paused ? 'Play motion' : 'Pause motion');
  }
  update(state) {
    this.state = state; const c = state.edgeConcept, summary = conceptSummary(c);
    const climate = c.climate || { scenario: 'calm', humidityPercent: 56, temperatureC: 26 };
    el('habitat-scene').dataset.weather = climate.scenario;
    el('habitat-scene').dataset.hub = c.wireless.hubOnline ? 'online' : 'offline';
    el('habitat-scene').dataset.fault = c.dispenser.fault || 'none';
    put('habitat-climate', `${climate.temperatureC}°C · ${climate.humidityPercent}% RH`);
    const lastVisitor = state.cats.find(cat => cat.id === c.bindings[c.reads.at(-1)?.token]?.catId);
    put('habitat-visitor', c.reads.length ? lastVisitor?.name || 'Unlinked chip · review' : 'Ready for Mango');
    put('habitat-visitor-note', `${summary.rawReads} reads → ${summary.sessions} visits → ${summary.uniqueLinkedCats} linked cats`);
    put('habitat-connection', c.wireless.hubOnline ? 'Hub available' : 'Offline · events retained');
    put('habitat-queue', `${summary.queued} packets waiting · ${summary.acknowledged} acknowledged`);
    put('habitat-offline', c.wireless.hubOnline ? 'Take hub offline' : 'Bring hub online');
    for (const button of document.querySelectorAll('[data-habitat-weather]')) button.setAttribute('aria-pressed', String(button.dataset.habitatWeather === climate.scenario));
    put('concept-unique', summary.uniqueLinkedCats); put('concept-sessions', summary.sessions); put('concept-reads', summary.rawReads); put('concept-unlinked', summary.unlinkedTags);
    put('concept-clock', `Concept clock ${time(c.clockMs)} · this fictional run`);
    const latest = c.reads.at(-1); put('concept-read-result', latest ? latest.repeated ? 'Repeated antenna read · grouped into the same visit' : 'New close-range visit session recorded' : 'A chip-linked visit starts with a close pass by the antenna.');
    const list = el('concept-visits'); list.replaceChildren();
    for (const session of c.sessions.toReversed().slice(0, 4)) {
      const binding = c.bindings[session.token], cat = state.cats.find(item => item.id === binding?.catId), item = node('li');
      item.append(node('span', 'concept-visit-paw', cat ? '✓' : '?'), node('b', '', cat?.name || 'Unlinked example chip'), node('small', '', `${session.readCount} read${session.readCount === 1 ? '' : 's'} · ${time(session.lastReadAt)}`)); list.append(item);
    }
    if (!c.sessions.length) list.append(node('li', 'concept-empty', 'Try Mango, then read the same chip twice. One visitor stays one visitor.'));
    el('concept-link-panel').hidden = !summary.unlinkedTags;
    const options = JSON.stringify(state.cats.map(cat => [cat.id, cat.name]));
    if (options !== this.catOptions) {
      this.catOptions = options; const previous = el('concept-link-cat').value; el('concept-link-cat').replaceChildren(new Option('Choose an existing identity', ''));
      for (const cat of state.cats) el('concept-link-cat').add(new Option(cat.name, cat.id)); el('concept-link-cat').value = previous;
    }
    el('concept-servo-card').dataset.fault = c.dispenser.fault || 'none';
    put('concept-motor-state', c.dispenser.fault ? 'Jam latched · motor inhibited' : 'Closed by default · ready for a mock cycle');
    const portion = c.portions.at(-1); put('concept-last-portion', portion ? `${portion.targetGrams} g requested · actual delivered weight unverified` : 'No portion requested. A chip read never starts the motor.');
    put('concept-cycle-count', `${c.portions.length} simulated gate cycle${c.portions.length === 1 ? '' : 's'}`);
    el('concept-inspect').hidden = !c.dispenser.fault; put('concept-queue', summary.queued); put('concept-acked', summary.acknowledged);
    el('concept-radio').value = c.wireless.mode; el('concept-hub-online').checked = c.wireless.hubOnline;
    put('concept-link-path', c.wireless.mode === 'wifi' ? 'ESP32 Wi-Fi → existing access point → care hub' : c.wireless.mode === 'ble' ? 'ESP32 Bluetooth LE → nearby phone / powered hub' : 'ESP32 + LoRa module → shared point-to-point radio hub');
    put('concept-hub-status', c.wireless.hubOnline ? 'Mock hub available · sync when ready' : 'Mock hub offline · local event queue retained');
    const trace = el('concept-events'); trace.replaceChildren();
    for (const event of c.events.toReversed().slice(0, 8)) { const item = node('li'); item.append(node('time', '', time(event.at)), node('span', '', event.title)); trace.append(item); }
    if (!c.events.length) trace.append(node('li', '', 'Simulated reader, gate and hub events will appear here.'));
    this.buttons();
  }
}
