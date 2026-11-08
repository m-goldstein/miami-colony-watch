// Workspace records are shown separately from this tab's USB and scenario readings.
const el = id => document.getElementById(id);
const text = (id, value) => { el(id).textContent = value; };
const icon = (name, className = 'icon') => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${name}`); svg.append(use); return svg;
};
export function mapCondition(colony, now = Date.now()) {
  const d = colony.device, m = d?.measurements;
  const fresh = d?.lifecycle === 'deployed' && d.online && m?.fresh &&
    now - Date.parse(d.lastSeenAt) < 120000 && now - Date.parse(m.sampledAt) <= 300000;
  const food = fresh ? m.foodPercent : null, water = fresh ? m.waterPercent : null, rain = fresh ? m.wet : null;
  const low = food != null && food <= d.calibration.foodLowPercent;
  const standing = water != null && water >= d.calibration.waterAlertPercent;
  const check = low || standing || rain === true || food == null;
  const state = !fresh ? 'offline' : check ? 'check' : 'calm';
  const note = !fresh ? 'No recent station signal. Arrange a connection or station check.' : standing ? 'The wetness probe needs a site check when access is safe. It cannot certify flood conditions.' : low ? 'Food reserve is running low. Plan a refill and check the hopper in person.' : rain ? 'The rain plate is wet. Check that food and shelter stay protected.' : food == null ? 'Food estimate unknown. Check the sensor and hopper before assuming it is empty.' : 'No sensor alert in this saved record. Keep regular care visits on the plan.';
  return { fresh: !!fresh, food, water, rain, low, standing, state, note };
}
export class ColonyMap {
  constructor() {
    this.mode = null; this.selected = new Map(); this.filter = 'all'; this.signature = ''; this.groups = [];
    this.expanded = false;
    el('map-expand').addEventListener('click', () => this.setExpanded(!this.expanded));
    el('network').addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.expanded) {
        event.preventDefault(); this.setExpanded(false); el('map-expand').focus({ preventScroll: true });
      }
    });
    document.querySelectorAll('[data-map-filter]').forEach(button => button.addEventListener('click', () => {
      this.filter = button.dataset.mapFilter; this.update(this.workspace, this.mode);
    }));
    el('map-pins').addEventListener('click', event => {
      const pin = event.target.closest('[data-map-group]'); if (!pin) return;
      const ids = this.groups[Number(pin.dataset.mapGroup)];
      this.selected.set(this.mode, ids[(ids.indexOf(this.selected.get(this.mode)) + 1) % ids.length]);
      this.update(this.workspace, this.mode);
    });
    el('map-colony-list').addEventListener('click', event => {
      const button = event.target.closest('[data-colony]'); if (!button) return;
      this.selected.set(this.mode, button.dataset.colony); this.update(this.workspace, this.mode);
    });
  }
  setExpanded(expanded) {
    this.expanded = expanded;
    el('network').dataset.expanded = String(expanded);
    el('map-expand').setAttribute('aria-expanded', String(expanded));
    text('map-expand-label', expanded ? 'Collapse map' : 'Expand map');
    document.querySelectorAll('[data-map-expanded]').forEach(panel => { panel.hidden = !expanded; });
  }
  update(workspace, mode) {
    this.workspace = workspace;
    if (this.mode !== mode) { this.mode = mode; this.filter = 'all'; }
    const records = (workspace?.colonies || []).filter(c => !!c.demo === (mode === 'demo'));
    const conditions = new Map(records.map(c => [c.id, mapCondition(c)]));
    const shown = records.filter(c => { const m = conditions.get(c.id); return this.filter === 'all' ||
      (this.filter === 'food' && m.low) || (this.filter === 'rain' && m.rain === true) ||
      (this.filter === 'water' && m.standing) || (this.filter === 'offline' && !m.fresh); });
    if (!shown.some(c => c.id === this.selected.get(mode))) this.selected.set(mode, shown[0]?.id || null);
    const selected = shown.find(c => c.id === this.selected.get(mode)), condition = selected ? conditions.get(selected.id) : null;
    text('map-scope', mode === 'demo' ? 'Fictional demo colonies · saved workspace signals · schematic locations.' : 'Physical colony records · saved workspace signals · positions are schematic, not GPS.');
    const signature = JSON.stringify([mode, shown.map(c => [c.id, c.name, c.neighborhood, c.mapX, c.mapY, conditions.get(c.id).state])]);
    if (signature !== this.signature) {
      this.signature = signature;
      const focused = document.activeElement?.dataset.colony;
      el('map-pins').replaceChildren(); el('map-colony-list').replaceChildren();
      const groups = new Map();
      for (const [index, colony] of shown.entries()) {
        const x = Math.max(9, Math.min(89, Number(colony.mapX) || 45));
        const y = Math.max(10, Math.min(85, Number(colony.mapY) * .8 + 6 || 50));
        const key = `${x},${y}`;
        if (!groups.has(key)) groups.set(key, { x, y, ids: [], index });
        groups.get(key).ids.push(colony.id);
        const button = document.createElement('button'); button.dataset.colony = colony.id; button.className = 'map-colony-option';
        const name = document.createElement('b'), area = document.createElement('small'), dot = document.createElement('i');
        name.textContent = colony.name; area.textContent = colony.neighborhood; dot.className = `record-dot ${conditions.get(colony.id).state}`;
        button.append(dot, name, area); el('map-colony-list').append(button);
      }
      this.groups = [...groups.values()].map(group => group.ids);
      [...groups.values()].forEach((group, index) => {
        const c = shown.find(c => c.id === group.ids[0]);
        const pin = document.createElement('button'); pin.className = 'colony-map-pin'; pin.dataset.mapGroup = index;
        pin.style.left = `${group.x}%`; pin.style.top = `${group.y}%`;
        pin.setAttribute('aria-label', group.ids.length > 1 ? `${group.ids.length} colonies at one schematic position. Activate to cycle records.` : `View ${c.name}`);
        const portrait = document.createElement('span'); portrait.className = 'pin-portrait'; portrait.style.setProperty('--coat', ['#a7aaa0','#e2b579','#6b7774','#d2b593','#c4ac8b','#a2b4aa'][group.index % 6]);
        const cat = icon('cat-face', 'pin-cat'); cat.setAttribute('viewBox','0 0 100 100'); portrait.append(cat);
        const dot = document.createElement('i'); dot.className = `pin-dot ${conditions.get(c.id).state}`; portrait.append(dot);
        if (group.ids.length > 1) { const count = document.createElement('b'); count.className = 'pin-count'; count.textContent = group.ids.length; portrait.append(count); }
        const label = document.createElement('span'); label.className = 'pin-label'; label.textContent = c.name;
        pin.append(portrait, label); el('map-pins').append(pin);
      });
      if (focused) [...el('map-colony-list').children].find(button => button.dataset.colony === focused)?.focus({ preventScroll: true });
    }
    document.querySelectorAll('[data-map-filter]').forEach(button => {
      const selected = button.dataset.mapFilter === this.filter; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', selected);
    });
    [...el('map-colony-list').children].forEach(button => { const active = button.dataset.colony === selected?.id; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', active); });
    [...el('map-pins').children].forEach(pin => { const active = this.groups[Number(pin.dataset.mapGroup)].includes(selected?.id); pin.classList.toggle('selected', active); pin.setAttribute('aria-pressed', active); });
    el('map-empty').hidden = shown.length > 0;
    text('map-empty', !workspace ? 'Local workspace unavailable. Refresh records to try again.' : !records.length ? 'No colony records in this mode. Add a colony in the field workspace.' : 'No matching colonies. Try another filter.');
    text('map-feedback', `${shown.length} of ${records.length} ${mode === 'demo' ? 'demo' : 'physical'} colonies shown`);
    text('map-colony-name', selected?.name || 'Choose a colony'); text('map-neighborhood', selected?.neighborhood || 'No colony matches this view.');
    text('map-record-note', selected ? `${selected.demo ? 'Fictional demo' : 'Physical colony'} · saved workspace record, separate from the USB panel.` : 'Saved workspace records, separate from the USB panel.');
    text('map-food', condition?.food != null ? `${condition.food}%` : 'Unknown');
    text('map-rain', condition?.rain == null ? 'Unknown' : condition.rain ? 'Wet' : 'Dry');
    text('map-water', condition?.water != null ? `${condition.water} / 100` : 'Unknown');
    for (const [name, value] of [['food', condition?.food], ['rain', condition?.rain], ['water', condition?.water]]) {
      el(`map-${name}`).classList.toggle('is-unknown', value == null);
    }
    text('map-cats', selected?.catCount ?? '—'); text('map-tnvr', selected?.tnvrCount ?? '—');
    text('map-care', condition?.note || 'Select a colony to review its saved station and caregiver records.');
    const sampledAt = selected?.device?.measurements.sampledAt;
    text('map-record-age', sampledAt ? `Last sample: ${new Date(sampledAt).toLocaleString()}${condition.fresh ? '' : ' · signal unavailable or stale'}. Wetness is an index, not water depth.` : 'No saved station sample. Wetness is an index, not water depth.');
    el('map-care').dataset.state = condition?.state || 'offline';
    el('map-colony-link').href = selected ? `/colonies.html?colony=${encodeURIComponent(selected.id)}#overview` : '/colonies.html#colonies';
    el('map-colony-link').firstChild.textContent = selected ? 'Care for this colony ' : 'Open the workspace ';
  }
}
