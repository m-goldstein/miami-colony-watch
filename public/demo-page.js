const el = id => document.getElementById(id);
const steps = [
  { target: 'network', title: 'Find the colony that needs you.', copy: 'Select a pin or try Low food. The colony summary shows where a caregiver should check next.', next: 'Next: weather & sensors' },
  { target: 'weather-sensors', title: 'Turn a signal into a next step.', copy: 'Try Food running low or Heat risk. Fetch the NWS outlook to compare area weather with station readings.', next: 'Next: the colony journal' },
  { target: 'colony-journal', title: 'Leave the next caregiver a clear handoff.', copy: 'Log a care visit or add a field note. Visits and reviewed updates stay in the saved colony exercise.', next: 'Next: photo classification' },
  { target: 'image-classification', title: 'Two sightings. One familiar cat.', copy: 'Preview the sample markings, then review “Stripey” in the journal. Confirm the match to Mango without adding a second identity.', next: 'Finish the tour ✓' }
];

export class DemoPage {
  constructor({ careDesk, useDemo }) {
    this.careDesk = careDesk; this.step = 0; this.useDemo = useDemo;
    el('start-colony-demo').addEventListener('click', () => {
      useDemo(); this.step = 0; el('demo-guide').hidden = false;
      document.body.dataset.guidedDemo = 'true'; this.showStep(true);
      el('demo-guide-next').focus({ preventScroll: true });
    });
    el('demo-guide-back').addEventListener('click', () => { this.step = Math.max(0, this.step - 1); this.showStep(true); });
    el('demo-guide-next').addEventListener('click', () => {
      if (this.step === steps.length - 1) this.close();
      else { this.step++; this.showStep(true); }
    });
    el('demo-guide-close').addEventListener('click', () => this.close());
    el('upload-cat-photo').addEventListener('click', () => { void this.openPhotoUpload(); });
    el('demo-field-note').addEventListener('click', () => { useDemo(); el('open-phone-update').click(); });
    el('classify-sample').addEventListener('click', () => {
      const open = el('photo-demo-result').hidden;
      el('photo-demo-result').hidden = !open;
      el('classify-sample').setAttribute('aria-expanded', String(open));
      el('classify-sample').firstChild.textContent = open ? 'Hide photo suggestions ' : 'Preview photo suggestions ';
      el('photo-demo-status').textContent = open
        ? 'Sample annotations shown. Confirm the identity in the journal; this preview does not change the census.'
        : 'Prepared sample annotations. Upload a photo to request AI suggestions in the journal.';
    });
    el('review-photo-demo').addEventListener('click', () => { void this.reviewPhoto(); });
    const sections = ['network', 'weather-sensors', 'colony-journal', 'image-classification'];
    const links = [...document.querySelectorAll('.site-header>nav a[href^="#"], .demo-path a, .bottom-nav a')];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        for (const link of links) {
          const active = link.hash === `#${entry.target.id}`;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
        }
      }
    }, { rootMargin: '-8% 0px -60% 0px', threshold: 0 });
    for (const id of sections) observer.observe(el(id));
  }
  showStep(scroll) {
    const step = steps[this.step];
    el('demo-guide-step').textContent = `STEP ${this.step + 1} OF ${steps.length}`;
    el('demo-guide-title').textContent = step.title;
    el('demo-guide-copy').textContent = step.copy;
    el('demo-guide-next').textContent = step.next;
    el('demo-guide-back').disabled = this.step === 0;
    el('demo-guide-progress').style.width = `${(this.step + 1) / steps.length * 100}%`;
    if (this.step === 0 && el('map-expand').getAttribute('aria-expanded') === 'false') el('map-expand').click();
    if (scroll) el(step.target).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  close() {
    el('demo-guide').hidden = true; delete document.body.dataset.guidedDemo;
    el('start-colony-demo').focus({ preventScroll: true });
  }
  update(state) {
    const visits = state.visits.length;
    el('journal-proof').textContent = visits
      ? `${visits} saved care visit${visits === 1 ? '' : 's'} · included in the colony’s evidence report.`
      : 'Saved visits become part of the colony’s evidence report.';
  }
  async openPhotoUpload() {
    this.useDemo();
    await this.careDesk.queue;
    if (!this.careDesk.state) {
      el('photo-demo-status').textContent = 'The shared journal is unavailable. Please reload and try again.';
      return;
    }
    el('open-phone-update').click(); el('field-photo').focus();
  }
  async reviewPhoto() {
    const button = el('review-photo-demo'); button.disabled = true;
    this.useDemo();
    el('photo-demo-status').textContent = 'Opening the sample sighting in the saved journal…';
    try {
      await this.careDesk.queue;
      if (!this.careDesk.state) throw new Error('The shared journal is unavailable. Please reload and try again.');
      if (!this.careDesk.state.importedAt) await this.careDesk.change('/import', {});
      el('inbox-filter').value = 'all';
      this.careDesk.selectUpdate('morning-02');
      this.close();
      el('photo-demo-status').textContent = 'Sample sighting opened. A caregiver confirms the match in the journal.';
      el('field-updates').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      el('review-source-title').setAttribute('tabindex', '-1');
      el('review-source-title').focus({ preventScroll: true });
    } catch (error) { el('photo-demo-status').textContent = error.message; }
    finally { button.disabled = false; }
  }
}
