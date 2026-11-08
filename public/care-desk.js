import { temperatureLabel, temperatureState, TEMPERATURE_ALERTS } from './temperature.js';
import { EdgeConceptUI } from './edge-concept-ui.js';
import { PhotoPicker, ticketSources, photoGallery } from './care-photos.js';
import { CatVisionUI } from './cat-vision-ui.js';

const el = id => document.getElementById(id);
const put = (id, value) => { el(id).textContent = value; };
const node = (tag, className, content) => {
  const element = document.createElement(tag); if (className) element.className = className;
  if (content != null) element.textContent = content; return element;
};
const dateLabel = at => at ? new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No dated sighting yet';
const actionButton = (label, key, value, className = 'text-link') => { const button = node('button', className, label); button.type = 'button'; button.dataset[key] = value; return button; };
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export class CareDesk {
  constructor({ notify, onChange, onStation }) {
    this.notify = notify; this.onChange = onChange; this.onStation = onStation; this.state = null; this.selected = null; this.taskId = null;
    this.queue = Promise.resolve(); this.stationSignature = ''; this.reportRequest = 0;
    this.edgeUI = new EdgeConceptUI({ act: body => this.change('/concept', body), notify });
    this.fieldPhoto = new PhotoPicker('field'); this.taskPhoto = new PhotoPicker('task');
    this.vision = new CatVisionUI({ getState: () => this.state, request: (path, body) => this.request(path, body, 'POST', 60000),
      renderTasks: () => { if (this.state) this.renderNeeds(); },
      selectCat: catId => { el('review-decision').value = 'existing'; el('review-cat').value = catId; this.reviewFields(); el('review-existing-fields').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
      useDescription: description => { el('review-decision').value = 'new'; el('review-new-description').value = description.slice(0, 300); this.reviewFields(); el('review-new-name').focus(); } });
    const today = new Date(), week = new Date(Date.now() - 6 * 86400000);
    el('report-from').value = week.toISOString().slice(0, 10); el('report-to').value = today.toISOString().slice(0, 10);
    el('review-procedure-date').max = today.toISOString().slice(0, 10);
    el('load-sample-updates').addEventListener('click', () => { void this.importSamples(); });
    el('start-rescue-demo').addEventListener('click', () => { void this.importSamples(true); });
    el('inbox-filter').addEventListener('change', () => this.renderInbox());
    el('rescue-cat-search').addEventListener('input', () => this.renderCats());
    el('followup-filter').addEventListener('change', () => this.renderNeeds());
    el('rescue-inbox-list').addEventListener('click', event => { const button = event.target.closest('[data-update]'); if (button) this.selectUpdate(button.dataset.update); });
    el('review-decision').addEventListener('change', () => this.reviewFields());
    el('review-cat').addEventListener('change', () => this.reviewTickets());
    el('source-review-form').addEventListener('submit', event => { event.preventDefault(); void this.confirmReview(); });
    el('open-phone-update').addEventListener('click', () => { el('phone-update-form').reset(); this.fieldPhoto.reset(); this.vision.prepareForm('field'); el('phone-update-error').hidden = true; el('phone-update-dialog').showModal(); });
    el('phone-update-form').addEventListener('submit', event => { event.preventDefault(); void this.phoneUpdate(); });
    el('rescue-needs-list').addEventListener('click', event => {
      const task = event.target.closest('[data-followup]'), source = event.target.closest('[data-source]');
      if (task) this.openTask(task.dataset.followup); else if (source) this.openSource(source.dataset.source);
    });
    document.querySelectorAll('[data-rescue-station]').forEach(button => button.addEventListener('click', () => { void this.station(button.dataset.rescueStation); }));
    el('followup-status').addEventListener('change', () => { el('followup-visit-fields').hidden = el('followup-status').value !== 'completed'; });
    el('followup-form').addEventListener('submit', event => { event.preventDefault(); void this.saveTask(); });
    for (const id of ['rescue-cat-list', 'rescue-all-cats']) el(id).addEventListener('click', event => { const cat = event.target.closest('[data-cat]'); if (cat) this.openCat(cat.dataset.cat); });
    el('cat-evidence-content').addEventListener('click', event => { const source = event.target.closest('[data-source]'); if (source) { el('cat-evidence-dialog').close(); this.openSource(source.dataset.source); } });
    el('report-evidence-list').addEventListener('click', event => {
      const source = event.target.closest('[data-source]'); if (source) this.openSource(source.dataset.source);
    });
    el('rescue-report-form').addEventListener('submit', event => { event.preventDefault(); void this.loadReport(); });
    el('pilot-budget-form').addEventListener('input', () => { this.renderBudget(); put('pilot-save-status', 'Unsaved assumptions'); });
    el('pilot-budget-form').addEventListener('submit', event => { event.preventDefault(); void this.savePilot(); });
    el('reset-rescue').addEventListener('click', () => el('reset-rescue-dialog').showModal());
    el('confirm-reset-rescue').addEventListener('click', () => { void this.reset(); });
    document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
    this.queue = this.refresh();
  }
  async request(path = '', body, method = 'POST', timeoutMs = 6000) {
    const response = await fetch(`/api/care-demo${path}`, { method: body === undefined ? 'GET' : method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), signal: AbortSignal.timeout(timeoutMs) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'The shared record could not be updated.'); return result;
  }
  async refresh() {
    try { this.accept(await this.request()); }
    catch (error) { put('rescue-status', error.message); document.querySelectorAll('#care-desk button, #start-rescue-demo').forEach(button => { button.disabled = true; }); }
  }
  change(path, body, method = 'POST') {
    const operation = this.queue.then(async () => { const result = await this.request(path, body, method); this.accept(result); return result; });
    this.queue = operation.catch(() => {}); return operation;
  }
  accept(state) {
    const first = !this.state; this.state = state;
    if (!state.updates.some(update => update.id === this.selected)) this.selected = state.updates.find(update => update.status === 'pending')?.id || state.updates[0]?.id;
    this.render(); if (first) this.populatePilot(); this.onChange(state);
    const signature = JSON.stringify(state.station);
    if (this.stationSignature !== signature) { this.stationSignature = signature; this.onStation(state.station.scenario, state.station); }
    void this.loadReport();
  }
  async importSamples(scroll = false) {
    try { await this.change('/import', {}); this.notify('Six fictional updates are ready. Review the two Mango sightings, then Pippa’s care concern.');
      if (scroll) el('field-updates').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    catch (error) { put('rescue-status', error.message); }
  }
  render() {
    const s = this.state, pending = s.updates.filter(update => update.status === 'pending').length, active = s.tasks.filter(task => task.status !== 'completed');
    put('rescue-cat-count', s.cats.length); put('rescue-tnvr-count', s.cats.filter(cat => cat.tnvrStatus === 'confirmed').length);
    put('rescue-pending-count', pending); put('rescue-task-count', active.length);
    put('rescue-task-note', `${active.filter(task => !task.assignee).length} still need a caregiver`);
    const linked = s.updates.filter(update => update.decision === 'existing' && update.catId === 'example-cat-1');
    put('rescue-cat-note', linked.length > 1 ? `${linked.length} Mango sightings · 1 cat identity` : 'One identity per cat');
    put('load-sample-updates', s.importedAt ? 'Sample batch loaded ✓' : 'Load 6 sample updates ↗'); el('load-sample-updates').disabled = !!s.importedAt;
    put('rescue-status', s.importedAt ? `Saved exercise · ${s.updates.length} original updates · ${pending} awaiting review. Reloading keeps your work.` : 'Start with the sample morning or add a fictional field update. The exercise saves separately from workspace and physical-device records.');
    put('rescue-food', s.station.online ? `${s.station.foodPercent}%` : 'Unknown'); put('rescue-rain', s.station.online ? s.station.wet ? 'Wet' : 'Dry' : 'Unknown');
    put('rescue-water', s.station.online ? `${s.station.waterIndex} / 100` : 'Unknown'); put('rescue-sensor-source', `Fictional sensor scenario · received ${dateLabel(s.station.receivedAt)}`);
    const temperatureC = s.station.online ? s.station.temperatureC : null, temperature = temperatureState(temperatureC);
    put('rescue-temperature', temperatureLabel(temperatureC));
    put('rescue-temperature-status', TEMPERATURE_ALERTS[temperature]?.badge || 'No temperature alert');
    el('rescue-station-temperature').dataset.status = temperature;
    this.renderInbox(); this.renderReview(); this.renderNeeds(); this.renderCats(); this.edgeUI.update(s);
  }
  renderInbox() {
    if (!this.state) return;
    const list = el('rescue-inbox-list'), filter = el('inbox-filter').value; list.replaceChildren();
    const updates = this.state.updates.filter(update => filter === 'all' || (filter === 'reviewed' ? update.status !== 'pending' : update.status === filter));
    if (!updates.length) { list.append(node('p', 'rescue-empty-note', this.state.updates.length ? 'No updates in this view.' : 'A quiet inbox, ready for the morning’s updates.')); return; }
    for (const update of updates) {
      const button = actionButton('', 'update', update.id, `inbox-update ${this.selected === update.id ? 'selected' : ''}`); button.setAttribute('aria-pressed', String(this.selected === update.id));
      const badge = node('span', `inbox-source-icon ${update.status}`, update.kind === 'photo' ? '▧' : update.kind === 'location' ? '⌖' : update.kind === 'document' ? '✓' : '✎');
      if (update.attachment) { const img = node('img'); img.src = update.attachment; img.alt = ''; img.loading = 'lazy'; badge.replaceChildren(img); }
      const copy = node('span', 'inbox-update-copy'), top = node('span', 'inbox-update-top');
      top.append(node('b', '', update.author), node('small', '', update.status === 'pending' ? 'Needs review' : update.status === 'dismissed' ? 'Dismissed' : 'Reviewed ✓'));
      copy.append(top, node('span', 'inbox-update-excerpt', update.text), node('small', 'inbox-update-meta', `${update.kind} · ${dateLabel(update.observedAt)}`));
      button.append(badge, copy); list.append(button);
    }
  }
  selectUpdate(id) { this.selected = id; this.renderInbox(); this.renderReview(); }
  renderReview() {
    const s = this.state, update = s?.updates.find(item => item.id === this.selected);
    this.vision.renderReview(update);
    el('review-empty').hidden = !!update; el('source-review').hidden = !update; if (!update) return;
    put('review-kind', `${update.kind.toUpperCase()} · ${update.provenance}`); put('review-status', update.status === 'pending' ? 'Human review needed' : update.status === 'dismissed' ? 'Dismissed with evidence' : 'Reviewed & saved');
    put('review-source-title', `${update.author}’s field update`); put('review-source-time', `${dateLabel(update.observedAt)} · ${s.colony.name} · source ${update.id}`);
    put('review-original', update.text); el('review-photo-wrap').hidden = !update.attachment; if (update.attachment) el('review-photo').src = update.attachment;
    el('review-photo-link').href = update.attachment || '#';
    el('review-photo').alt = update.photo ? 'Uploaded cat photo retained with this field report' : 'Generated example photo attached to a fictional cat sighting';
    put('review-photo-caption', update.photo ? 'Caregiver upload · compare markings and context before confirming identity.' : 'Generated example photo · reused in two fictional sightings. A caregiver confirms identity.');
    const duplicates = (update.samePhotoSources || []).map(id => s.updates.find(item => item.id === id)).filter(Boolean);
    el('review-duplicates').hidden = !duplicates.length;
    el('review-duplicates').replaceChildren(node('b', '', 'This photo is already in the inbox.'), node('p', '', 'Compare the earlier report before creating a new identity or ticket. Matching file content alone does not confirm the cat.'));
    for (const previous of duplicates) { const button = actionButton(`Compare ${previous.author}’s report ↗`, 'duplicate', previous.id); button.addEventListener('click', () => this.selectUpdate(previous.id)); el('review-duplicates').append(button); }
    el('review-location').hidden = update.kind !== 'location'; el('source-review-form').hidden = update.status !== 'pending'; el('review-receipt').hidden = update.status === 'pending';
    if (update.status !== 'pending') {
      const cat = s.cats.find(item => item.id === update.catId);
      put('review-receipt', `${update.reviewer} reviewed this ${dateLabel(update.reviewedAt)}. ${cat ? `Linked to ${cat.name} (${cat.id}). ` : 'Colony evidence retained. '}${update.decision === 'new' ? 'One new identity added. ' : update.decision === 'existing' ? 'Census total unchanged by this sighting. ' : ''}${update.taskId ? 'Evidence attached to the shared care ticket. ' : ''}${update.reviewNote || ''}`); return;
    }
    el('review-cat').replaceChildren(new Option('Choose an identity', ''));
    for (const cat of s.cats) el('review-cat').add(new Option(`${cat.name} · ${cat.description}`, cat.id));
    el('review-cat').value = update.suggestedCatId || ''; el('review-decision').value = update.suggestedAction || 'existing';
    el('review-alias').value = update.suggestedCatId && update.suggestedName !== s.cats.find(cat => cat.id === update.suggestedCatId)?.name ? update.suggestedName || '' : '';
    el('review-new-name').value = update.suggestedName || ''; el('review-new-description').value = update.suggestedDescription || '';
    el('review-evidence').value = ''; el('review-reference').value = update.documentRef || '';
    el('review-procedure-date').value = new Date().toISOString().slice(0, 10); el('review-form-error').hidden = true; this.reviewFields();
  }
  reviewFields() {
    const value = el('review-decision').value;
    el('review-existing-fields').hidden = !['existing', 'procedure'].includes(value); el('review-new-fields').hidden = value !== 'new'; el('review-procedure-fields').hidden = value !== 'procedure';
    el('review-cat').required = ['existing', 'procedure'].includes(value); el('review-alias').closest('label').hidden = value === 'procedure';
    el('review-new-name').required = value === 'new'; el('review-new-description').required = value === 'new';
    el('review-evidence').required = ['procedure', 'dismiss'].includes(value); el('review-reference').required = value === 'procedure'; el('review-procedure-date').required = value === 'procedure';
    put('review-effect', value === 'new' ? 'Adds one identity with TNVR unknown.' : value === 'procedure' ? 'Requires a checked record and procedure date.' : value === 'existing' ? 'Adds a sighting, keeping the cat counted once.' : 'Original source remains in the record.');
    this.reviewTickets();
  }
  reviewTickets() {
    const decision = el('review-decision').value, catId = decision === 'existing' ? el('review-cat').value : null;
    const cat = this.state.cats.find(item => item.id === catId), preview = el('review-identity-preview'); preview.replaceChildren(); preview.hidden = !cat;
    if (cat) { if (cat.photo) preview.append(photoGallery([{ url: cat.photo, name: `Reference photo for ${cat.name}` }])); const copy = node('div'); copy.append(node('b', '', `${cat.name} · existing identity`), node('p', '', cat.description), node('small', '', 'Compare markings, place and time. AI suggestions need your confirmation.')); preview.append(copy); }
    const tasks = ['existing', 'colony'].includes(decision) ? this.state.tasks.filter(task => task.status !== 'completed' && (task.catId || null) === (catId || null)) : [];
    el('review-ticket-wrap').hidden = !tasks.length; el('review-ticket').replaceChildren(new Option('Separate issue / no existing ticket', ''));
    for (const task of tasks) el('review-ticket').add(new Option(`${task.title} · ${task.assignee || 'unassigned'}`, task.id));
    put('review-ticket-hint', `${tasks.length} open ticket${tasks.length === 1 ? '' : 's'} for this ${catId ? 'cat' : 'colony'}. If this is the same issue, attach the evidence to one ticket.`);
  }
  async confirmReview() {
    if (!el('source-review-form').reportValidity()) return;
    const button = el('confirm-update'); button.disabled = true; el('review-form-error').hidden = true;
    const sourceId = this.selected;
    try {
      await this.change(`/updates/${encodeURIComponent(sourceId)}/review`, { decision: el('review-decision').value, reviewer: el('review-author').value.trim(), catId: el('review-cat').value,
        alias: el('review-alias').value.trim(), name: el('review-new-name').value.trim(), description: el('review-new-description').value.trim(), note: el('review-evidence').value.trim(), reference: el('review-reference').value.trim(), procedureDate: el('review-procedure-date').value, relatedTaskId: el('review-ticket').value });
      this.notify('Review saved. Original evidence stays attached to the shared record.');
    } catch (error) { if (this.selected === sourceId) { put('review-form-error', error.message); el('review-form-error').hidden = false; } }
    finally { button.disabled = false; }
  }
  async phoneUpdate() {
    const button = el('phone-update-form').querySelector('[type=submit]'); button.disabled = true;
    const analyze = el('field-ai-check').checked;
    try { const state = await this.change('/updates', { author: el('phone-update-author').value.trim(), text: el('phone-update-text').value.trim(), needsCare: el('phone-update-care').checked, photo: this.fieldPhoto.value() });
      this.selected = state.updates.at(-1).id; this.renderInbox(); this.renderReview(); el('phone-update-dialog').close(); el('field-updates').scrollIntoView({ behavior: 'smooth' }); this.notify('Field update saved to the review inbox.');
      if (analyze && state.updates.at(-1).photo) void this.vision.analyze(state.updates.at(-1).photo.id); }
    catch (error) { put('phone-update-error', error.message); el('phone-update-error').hidden = false; }
    finally { button.disabled = false; }
  }
  renderNeeds() {
    const list = el('rescue-needs-list'), filter = el('followup-filter').value; list.replaceChildren();
    const tasks = this.state.tasks.filter(task => filter === 'all' || (filter === 'active' ? task.status !== 'completed' : task.status === 'completed')).sort((a, b) => Number(b.severity === 'urgent') - Number(a.severity === 'urgent'));
    if (!tasks.length) { list.append(node('div', 'rescue-empty-state', filter === 'completed' ? 'Completed follow-ups will keep their outcomes and visit evidence here.' : 'No follow-ups in this view. Review a care concern or try the low-food signal to plan the next visit.')); return; }
    for (const task of tasks) {
      const card = node('article', `rescue-task ${task.status}`), header = node('div', 'rescue-task-header');
      header.append(node('span', `care-severity ${task.severity}`, task.status === 'completed' ? 'Completed ✓' : task.severity === 'urgent' ? 'Needs attention' : 'Care follow-up'), node('small', '', task.origin));
      card.append(header, node('h3', '', task.title), node('p', '', task.status === 'completed' ? task.resolution : `${task.assignee || 'No caregiver assigned'}${task.dueAt ? ` · check-in ${dateLabel(task.dueAt)}` : ' · agree on a check-in'}`));
      if (task.detail && task.status !== 'completed') card.append(node('p', 'rescue-task-detail', task.detail));
      const sources = ticketSources(this.state, task), photos = [...sources.filter(source => source.attachment).map(source => ({ id: source.photo?.id, url: source.attachment, name: `Photo report from ${source.author}` })), ...(task.photos || [])];
      if (photos.length) card.append(photoGallery(photos));
      if (photos.some(photo => photo.id)) card.append(this.vision.taskEvidence(photos));
      card.append(node('small', 'ticket-evidence-count', `${sources.length} source report${sources.length === 1 ? '' : 's'} · ${photos.length} photo${photos.length === 1 ? '' : 's'} · one care ticket`));
      const actions = node('div', 'rescue-task-actions'); actions.append(actionButton('See the source ↗', 'source', task.sourceId));
      for (const source of sources.filter(source => source.id !== task.sourceId)) actions.append(actionButton(`${source.author}’s report ↗`, 'source', source.id));
      if (task.status !== 'completed') actions.append(actionButton(task.assignee ? 'Update follow-up' : 'Assign a caregiver', 'followup', task.id, 'button outline small'));
      else actions.append(node('small', '', `${task.assignee} · ${dateLabel(task.completedAt)}`));
      card.append(actions); list.append(card);
    }
  }
  openTask(taskId) {
    const task = this.state.tasks.find(item => item.id === taskId); if (!task) return; this.taskId = taskId;
    put('followup-title', task.title); put('followup-context', `${this.state.colony.name} · ${task.origin}. Original evidence remains linked.`);
    el('followup-assignee').value = task.assignee || 'Elena'; el('followup-status').value = 'assigned';
    el('followup-due').value = task.dueAt ? new Date(Date.parse(task.dueAt) - new Date(task.dueAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
    el('followup-note').value = ''; el('followup-cats').value = 0; el('followup-food').checked = false; el('followup-water').checked = false;
    el('followup-visit-fields').hidden = true; el('followup-error').hidden = true; el('followup-dialog').showModal();
    this.taskPhoto.reset(); this.vision.prepareForm('task');
  }
  async saveTask() {
    const button = el('followup-form').querySelector('[type=submit]'); button.disabled = true;
    const analyze = el('task-ai-check').checked, taskId = this.taskId;
    try {
      const photo = this.taskPhoto.value();
      const state = await this.change(`/tasks/${encodeURIComponent(taskId)}`, { status: el('followup-status').value, assignee: el('followup-assignee').value.trim(),
        dueAt: el('followup-due').value ? new Date(el('followup-due').value).toISOString() : '', note: el('followup-note').value.trim(), catsSeen: Number(el('followup-cats').value), foodRefilled: el('followup-food').checked, waterChanged: el('followup-water').checked, photo }, 'PATCH');
      el('followup-dialog').close(); this.notify('Care follow-up saved with its evidence.');
      if (analyze && photo) { const attached = state.tasks.find(task => task.id === taskId)?.photos?.find(item => item.id === photo.id); if (attached) void this.vision.analyze(attached.id); }
    } catch (error) { put('followup-error', error.message); el('followup-error').hidden = false; }
    finally { button.disabled = false; }
  }
  openSource(sourceId) {
    const update = this.state.updates.find(item => item.id === sourceId);
    if (update) { el('inbox-filter').value = 'all'; this.selectUpdate(sourceId); el('field-updates').scrollIntoView({ behavior: 'smooth' }); return; }
    const evidence = this.state.events.filter(item => item.sourceId === sourceId || item.id === this.state.tasks.find(task => task.sourceId === sourceId)?.evidenceId).find(item => item.reading);
    const content = el('sensor-evidence-content'); content.replaceChildren();
    if (evidence) {
      const reading = evidence.reading;
      content.append(node('p', '', `${evidence.title} · ${dateLabel(evidence.occurredAt)}`), node('p', '', `Source ${reading.id}. Food ${reading.online ? reading.foodPercent + '%' : 'unknown'}, rain ${reading.online ? reading.wet ? 'wet' : 'dry' : 'unknown'}, base wetness ${reading.online ? reading.waterIndex : 'unknown'}.`),
        node('p', '', `Ambient temperature: ${temperatureLabel(reading.online ? reading.temperatureC : null)}. Humidity is not reported by the current firmware.`),
        node('p', 'small-note', 'Fictional Arduino reading. It cannot diagnose a cat or certify safe access.'));
    } else content.append(node('p', '', 'The evidence record is retained in the report.'));
    el('sensor-evidence-dialog').showModal();
  }
  async station(scenario) {
    try { return await this.change('/station', { scenario }); }
    catch (error) { this.notify(error.message); return null; }
  }
  recordVisit(body) { return this.change('/visits', body); }
  renderCats() {
    const query = el('rescue-cat-search').value.toLowerCase().trim(), s = this.state;
    const visible = s.cats.filter(cat => `${cat.name} ${cat.aliases.join(' ')} ${cat.description}`.toLowerCase().includes(query));
    const ordered = [...visible].sort((a, b) => Number(b.id === 'example-cat-1') - Number(a.id === 'example-cat-1') || b.observations.length - a.observations.length);
    const list = el('rescue-cat-list'); list.replaceChildren();
    for (const cat of ordered.slice(0, query ? 9 : 3)) {
      const card = actionButton('', 'cat', cat.id, 'rescue-cat-card'), avatar = node('span', 'rescue-cat-avatar');
      if (cat.photo) { const img = node('img'); img.src = cat.photo; img.alt = cat.photo.startsWith('/api/') ? 'Photo from a reviewed field report' : 'Generated example portrait'; avatar.append(img); }
      else { avatar.textContent = cat.name.slice(0, 1); }
      const copy = node('span', 'rescue-cat-card-copy'); copy.append(node('b', '', cat.name), node('span', '', cat.description), node('small', '', cat.aliases.length ? `Also known as ${cat.aliases.join(', ')}` : `${cat.observations.length} linked source updates`), node('span', `cat-record-badge ${cat.tnvrStatus}`, cat.tnvrStatus === 'confirmed' ? 'TNVR record confirmed' : 'TNVR unknown · review needed'));
      card.append(avatar, copy, node('span', 'cat-record-arrow', '↗')); list.append(card);
    }
    if (!visible.length) list.append(node('p', 'rescue-empty-note', 'No identity or alias matches this search.'));
    put('rescue-census-note', `${s.cats.length} unique identities · ${s.updates.filter(update => update.catId && update.decision !== 'procedure').length} reviewed sightings · pending updates never inflate the census.`);
    put('rescue-all-cats-count', s.cats.length); el('rescue-all-cats').replaceChildren();
    for (const cat of visible) el('rescue-all-cats').append(actionButton(`${cat.name}${cat.aliases.length ? ' / ' + cat.aliases.join(', ') : ''} · ${cat.tnvrStatus}`, 'cat', cat.id, 'all-cat-option'));
  }
  openCat(catId) {
    const cat = this.state.cats.find(item => item.id === catId); if (!cat) return;
    put('cat-evidence-title', cat.name); const content = el('cat-evidence-content'); content.replaceChildren();
    content.append(node('p', '', cat.description), node('p', 'small-note', `Stable identity: ${cat.id}. Aliases: ${cat.aliases.join(', ') || 'none recorded'}.`), node('p', 'cat-record-detail', `TNVR: ${cat.tnvrStatus}. ${cat.tnvrEvidence || 'No procedure evidence has been verified.'}${cat.procedureDate ? ` Procedure date: ${cat.procedureDate}. Reference: ${cat.recordRef}.` : ''}`), node('h3', '', 'The observations behind this identity'));
    if (!cat.observations.length) content.append(node('p', 'small-note', 'Baseline exercise identity. No new field update has been linked yet.'));
    for (const sourceId of cat.observations) {
      const update = this.state.updates.find(item => item.id === sourceId);
      if (update) { const item = node('article', 'cat-source-record'); item.append(node('b', '', `${update.author} · ${dateLabel(update.observedAt)}`), node('p', '', update.text), node('small', '', `Reviewed by ${update.reviewer} · ${update.reviewNote || 'Source linked after human review.'}`), actionButton('Open original source ↗', 'source', update.id)); if (update.attachment) item.append(photoGallery([{ url: update.attachment }])); content.append(item); }
    }
    el('cat-evidence-dialog').showModal();
  }
  async loadReport() {
    const requestId = ++this.reportRequest, params = new URLSearchParams({ from: el('report-from').value, to: el('report-to').value });
    try {
      const report = await this.request(`/report?${params}`); if (requestId !== this.reportRequest) return;
      put('report-observed', report.period.uniqueCatsObserved); put('report-sightings', `${report.period.sightings} reviewed sightings in this period`);
      put('report-procedures', report.period.procedures); put('report-visits', report.period.visits); put('report-followups', report.period.completedFollowups);
      put('report-census-context', `Current colony snapshot: ${report.current.cats} unique cats · ${report.current.confirmedTnvr} confirmed TNVR records, including baseline · ${report.current.pendingUpdates} updates pending review · ${report.current.openTasks} open follow-ups.`);
      put('report-status', 'Fictional records · dates use UTC · evidence retained'); put('report-evidence-count', `${report.evidence.length} records`);
      el('download-rescue-report').href = `/api/care-demo/report.csv?${params}`; el('download-rescue-report').removeAttribute('aria-disabled');
      const list = el('report-evidence-list'); list.replaceChildren();
      for (const record of report.evidence.toReversed().slice(0, 100)) {
        const item = node('li'); item.append(node('time', '', dateLabel(record.occurredAt)), node('b', '', record.title || record.kind), node('small', '', `${record.id}${record.reference ? ' · ' + record.reference : ''}${record.note ? ' · ' + record.note : ''}${record.reading ? ` · ambient ${temperatureLabel(record.reading.online ? record.reading.temperatureC : null)}` : ''}`));
        if (record.sourceId) item.append(actionButton('Check source ↗', 'source', record.sourceId)); list.append(item);
      }
      if (!report.evidence.length) list.append(node('li', 'small-note', 'No dated activity in this period. Baseline census records are not new completions.'));
    } catch (error) { if (requestId === this.reportRequest) { put('report-status', error.message); el('download-rescue-report').removeAttribute('href'); el('download-rescue-report').setAttribute('aria-disabled', 'true'); } }
  }
  populatePilot() {
    for (const key of ['equipment', 'enclosure', 'power', 'gateway', 'monthly', 'maintenance', 'notes']) el(`pilot-${key}`).value = this.state.pilot[key] ?? '';
    this.renderBudget();
  }
  renderBudget() {
    const values = ['equipment', 'enclosure', 'power', 'gateway'].map(key => el(`pilot-${key}`).value);
    const entered = values.filter(value => value !== ''), valid = entered.every(value => Number.isFinite(Number(value)) && Number(value) >= 0);
    put('pilot-total', entered.length && valid ? money(entered.reduce((sum, value) => sum + Number(value), 0)) : 'Unknown');
    put('pilot-cost-scope', `${entered.length} of 4 setup costs entered · operating estimate separate`);
  }
  async savePilot() {
    const body = {}; for (const key of ['equipment', 'enclosure', 'power', 'gateway', 'monthly']) body[key] = el(`pilot-${key}`).value === '' ? '' : Number(el(`pilot-${key}`).value);
    body.maintenance = el('pilot-maintenance').value.trim(); body.notes = el('pilot-notes').value.trim();
    try { await this.change('/pilot', body, 'PATCH'); put('pilot-save-status', 'Pilot assumptions saved to this exercise.'); }
    catch (error) { put('pilot-save-status', error.message); }
  }
  async reset() {
    try { await this.change('/reset', { confirm: 'reset-fictional-exercise' }); this.selected = null; this.populatePilot(); this.render(); el('reset-rescue-dialog').close(); this.notify('Fictional exercise reset. Field workspace and physical records are unchanged.'); }
    catch (error) { put('rescue-status', error.message); }
  }
}
