import { conceptSummary } from './edge-concept-model.js';
const el = id => document.getElementById(id);
const put = (id, value) => { el(id).textContent = value; };
const node = (tag, className, content) => { const element = document.createElement(tag); if (className) element.className = className; if (content != null) element.textContent = content; return element; };
const time = at => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
export class EdgeConceptUI {
  constructor({ act, notify }) {
    this.act = act; this.notify = notify; this.state = null; this.pending = false; this.lastAttempt = null;
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
      await this.act(body); put('concept-status', 'Concept event saved. No physical reader, dispenser or radio was operated.'); return true;
    } catch (error) { put('concept-status', error.message); return false; }
    finally { this.pending = false; this.buttons(); }
  }
  buttons() {
    document.querySelectorAll('#future-station button').forEach(button => { button.disabled = this.pending || !this.state; });
    if (this.state?.edgeConcept.dispenser.fault) el('concept-dispense').disabled = true;
  }
  update(state) {
    this.state = state; const c = state.edgeConcept, summary = conceptSummary(c);
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
