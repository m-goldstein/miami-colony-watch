export class PhotoPicker {
  constructor(prefix) {
    this.root = document.getElementById(`${prefix}-photo-picker`);
    this.input = this.root.querySelector('input');
    this.preview = this.root.querySelector('img');
    this.status = this.root.querySelector('[role=status]');
    this.remove = this.root.querySelector('button');
    this.photo = null; this.busy = false; this.revision = 0; this.error = null;
    this.input.addEventListener('change', () => { void this.prepare(); });
    this.remove.addEventListener('click', () => this.reset());
  }
  reset(clearInput = true) {
    this.revision++; this.photo = null; this.error = null; this.busy = false; if (clearInput) this.input.value = '';
    this.preview.hidden = true; this.preview.removeAttribute('src'); this.remove.hidden = true;
    this.status.textContent = 'JPEG, PNG or WebP · up to 10 MB. Resized before saving; location metadata removed.';
  }
  value() {
    if (this.busy) throw new Error('The photo is still being prepared. Please try again in a moment.');
    if (this.error) throw new Error(this.error);
    return this.photo;
  }
  async prepare() {
    const file = this.input.files[0]; this.reset(false);
    if (!file) return;
    const revision = this.revision; this.busy = true; this.remove.hidden = false;
    this.status.textContent = 'Preparing your cat photo…';
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
      const src = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('This photo could not be read.')); reader.readAsDataURL(file);
      });
      const img = new Image(); img.src = src; await img.decode();
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let dataUrl;
      for (const quality of [.84, .72, .58, .4]) { dataUrl = canvas.toDataURL('image/jpeg', quality); if ((dataUrl.length - 23) * .75 <= 512 * 1024) break; }
      if ((dataUrl.length - 23) * .75 > 512 * 1024) throw new Error('This image is too detailed. Try a smaller crop of the cat.');
      const bytes = Uint8Array.from(atob(dataUrl.slice(23)), character => character.charCodeAt(0));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const id = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (revision !== this.revision) return;
      this.photo = { id, name: file.name.slice(0, 120), dataUrl }; this.preview.src = dataUrl; this.preview.hidden = false;
      this.status.textContent = `${file.name} · ${Math.ceil((dataUrl.length - 23) * .75 / 1024)} KB ready to attach`;
    } catch (error) {
      if (revision === this.revision) { this.error = error.message === 'The source image cannot be decoded.' ? 'This image could not be opened. Choose another photo.' : error.message; this.status.textContent = this.error; }
    } finally { if (revision === this.revision) this.busy = false; }
  }
}

export function ticketSources(state, task) {
  const ids = new Set([task.sourceId, ...(task.sourceIds || [])]);
  return state.updates.filter(update => ids.has(update.id));
}

export function photoGallery(photos) {
  const gallery = document.createElement('div'); gallery.className = 'ticket-photo-gallery';
  for (const photo of photos) {
    const link = document.createElement('a'); link.href = photo.url; link.target = '_blank'; link.rel = 'noopener'; link.title = 'Open attached photo';
    const img = document.createElement('img'); img.src = photo.url; img.alt = photo.name || 'Cat photo attached to this care ticket'; img.loading = 'lazy';
    link.append(img); gallery.append(link);
  }
  return gallery;
}
