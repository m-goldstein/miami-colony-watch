const el = id => document.getElementById(id);
const node = (tag, className, text) => { const item = document.createElement(tag); if (className) item.className = className; if (text != null) item.textContent = text; return item; };
const button = (text, key, value, className = 'button outline small') => { const item = node('button', className, text); item.type = 'button'; item.dataset[key] = value; return item; };
const labels = { single_cat: 'One cat visible', multiple_cats: 'Multiple cats · separate photos help', no_cat: 'No cat detected', unclear: 'Cat visibility is unclear' };

export class CatVisionUI {
  constructor({ getState, request, selectCat, useDescription, renderTasks }) {
    this.getState = getState; this.request = request; this.selectCat = selectCat; this.useDescription = useDescription; this.renderTasks = renderTasks;
    this.config = null; this.loading = new Set(); this.errors = new Map();
    for (const root of [el('review-ai-panel'), el('rescue-needs-list')]) root.addEventListener('click', event => {
      const analyze = event.target.closest('[data-ai-analyze]'), match = event.target.closest('[data-ai-match]'), description = event.target.closest('[data-ai-description]');
      if (analyze) void this.analyze(analyze.dataset.aiAnalyze);
      if (match) this.selectCat(match.dataset.aiMatch);
      if (description) this.useDescription(this.getState()?.photoAnalyses?.[description.dataset.aiDescription]?.description || '');
    });
    for (const prefix of ['field', 'task']) this.prepareForm(prefix);
    void this.loadStatus();
  }
  async loadStatus() {
    try { this.config = await this.request('/photo-analysis/status'); }
    catch { this.config = { configured: false }; }
    for (const prefix of ['field', 'task']) this.prepareForm(prefix);
    this.renderReview(this.selected); if (this.getState()) this.renderTasks();
  }
  prepareForm(prefix) {
    const checkbox = el(`${prefix}-ai-check`); checkbox.disabled = !this.config?.configured; checkbox.checked = !!this.config?.configured;
    el(`${prefix}-ai-availability`).textContent = this.config == null ? 'Checking AI availability…' : this.config.configured ? 'OpenAI analyzes the resized photo and compares up to 6 reference photos and 60 cat descriptions. A person confirms identity.' : 'AI is not configured on this server. Photo upload and manual review are available.';
  }
  async analyze(photoId) {
    if (this.loading.has(photoId)) return;
    const exercise = this.getState()?.createdAt;
    this.loading.add(photoId); this.errors.delete(photoId); this.renderReview(this.selected); this.renderTasks();
    try {
      const result = await this.request(`/photos/${encodeURIComponent(photoId)}/analyze`, {});
      const state = this.getState();
      if (state?.createdAt === exercise) { state.photoAnalyses ||= {}; state.photoAnalyses[photoId] = result.analysis; }
    } catch (error) { if (this.getState()?.createdAt === exercise) this.errors.set(photoId, error.message); }
    finally { this.loading.delete(photoId); this.renderReview(this.selected); this.renderTasks(); }
  }
  renderReview(update) {
    this.selected = update;
    const panel = el('review-ai-panel'), photoId = update?.photo?.id; panel.hidden = !photoId; panel.replaceChildren(); if (!photoId) return;
    const state = this.getState(), analysis = state?.photoAnalyses?.[photoId], busy = this.loading.has(photoId), error = this.errors.get(photoId);
    const heading = node('div', 'ai-review-heading'), copy = node('div'); copy.append(node('span', 'eyebrow', 'A SECOND LOOK AT THE EVIDENCE'), node('h4', '', 'AI photo review'));
    heading.append(copy, node('span', 'ai-provider-badge', 'OpenAI')); panel.append(heading);
    const action = button(busy ? 'Looking at the photo…' : analysis ? 'Refresh suggestions' : 'Analyze cat photo', 'aiAnalyze', photoId);
    action.disabled = busy || !this.config?.configured;
    if (busy) { const progress = node('p', 'ai-analysis-progress', 'Comparing visible markings with the colony records. You can keep reviewing while this runs.'); progress.setAttribute('role', 'status'); panel.append(progress); }
    if (error) { const message = node('p', 'ai-analysis-error', error); message.setAttribute('role', 'alert'); panel.append(message); }
    if (!analysis) {
      panel.append(node('p', 'ai-review-intro', this.config?.configured ? 'Get visible coat details and possible existing-cat matches. The original photo and your report stay saved.' : 'AI is unavailable. You can still compare the photo and link a cat manually.'), action,
        node('p', 'ai-review-disclaimer', 'Analysis sends this photo and a limited set of colony reference photos and descriptions to OpenAI. Identity and ticket decisions remain yours.'));
      return;
    }
    const summary = node('div', `ai-photo-summary ${analysis.catPresence}`);
    summary.append(node('b', '', labels[analysis.catPresence]), node('span', '', `Image quality: ${analysis.imageQuality}`), node('p', '', analysis.description)); panel.append(summary);
    if (analysis.catPresence === 'single_cat') {
      const tags = node('div', 'ai-appearance-tags');
      for (const tag of [...analysis.coatColors, analysis.coatPattern, ...analysis.distinctiveMarkings]) if (tag !== 'unknown') tags.append(node('span', '', tag));
      panel.append(tags, node('h5', '', 'Possible familiar faces'));
      if (!analysis.matches.length) panel.append(node('p', 'ai-review-intro', 'No convincing match in the compared records. This does not establish a new cat; check the census and original evidence.'));
    }
    for (const match of analysis.matches) {
      const cat = state.cats.find(cat => cat.id === match.catId); if (!cat) continue;
      const card = node('article', 'ai-cat-match');
      if (cat.photo) { const img = node('img'); img.src = cat.photo; img.alt = `Reference photo for ${cat.name}`; img.loading = 'lazy'; card.append(img); }
      const content = node('div'); content.append(node('b', '', cat.name), node('span', 'ai-match-strength', `${match.similarity} resemblance · ${match.basis === 'description_only' ? 'record description only' : 'photo + record'}`), node('p', '', match.reason));
      if (match.differences) content.append(node('small', '', `Check: ${match.differences}`));
      const open = state.tasks.filter(task => task.catId === cat.id && task.status !== 'completed').length;
      if (open) content.append(node('small', 'ai-open-tickets', `${open} open care ticket${open === 1 ? '' : 's'} · compare before reporting the same issue again`));
      if (update.status === 'pending') content.append(button(`Compare with ${cat.name}`, 'aiMatch', cat.id));
      card.append(content); panel.append(card);
    }
    if (analysis.limitations) panel.append(node('p', 'ai-review-limitations', analysis.limitations));
    const controls = node('div', 'ai-review-actions'); controls.append(action);
    if (analysis.catPresence === 'single_cat' && analysis.imageQuality !== 'poor' && update.status === 'pending') controls.append(button('Use description in new-cat form', 'aiDescription', photoId, 'text-link'));
    panel.append(controls, node('p', 'ai-review-disclaimer', `AI suggestions can be wrong. Compared ${analysis.scope.comparedCats} of ${analysis.scope.totalCats} records and ${analysis.scope.referencePhotos} reference photos; other records use descriptions only. Resemblance is not confirmed identity. Saved ${new Date(analysis.analyzedAt).toLocaleDateString()} · ${analysis.model}.`));
  }
  taskEvidence(photos) {
    const root = node('div', 'ticket-ai-evidence');
    for (const photo of [...new Map(photos.filter(photo => photo.id).map(photo => [photo.id, photo])).values()]) {
      const analysis = this.getState()?.photoAnalyses?.[photo.id], busy = this.loading.has(photo.id), error = this.errors.get(photo.id);
      const row = node('div', 'ticket-ai-row');
      if (analysis) row.append(node('b', '', `${labels[analysis.catPresence]} · AI suggestion`), node('p', '', analysis.description));
      if (error) row.append(node('p', 'ai-analysis-error', error));
      const action = button(busy ? 'Analyzing photo…' : analysis ? 'Refresh photo analysis' : 'Analyze attached cat photo', 'aiAnalyze', photo.id, 'text-link');
      action.disabled = busy || !this.config?.configured; row.append(action); root.append(row);
    }
    return root;
  }
}
