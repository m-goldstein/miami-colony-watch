import { createHash } from 'node:crypto';
import { fail, text } from './domain.js';

// Browser uploads are resized and re-encoded as JPEG, without EXIF/location data.
// Store bytes separately so fetching the care desk does not download every photo.
export function saveCarePhoto(store, input) {
  if (input == null) return null;
  if (typeof input !== 'object' || typeof input.dataUrl !== 'string' ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.dataUrl)) fail('Choose a JPEG, PNG or WebP photo using the photo picker.');
  const encoded = input.dataUrl.slice(23);
  if (encoded.length > 700000) fail('The prepared photo must be 512 KB or smaller.', 413);
  const data = Buffer.from(encoded, 'base64');
  if (data.length > 512 * 1024) fail('The prepared photo must be 512 KB or smaller.', 413);
  if (data.length < 20 || data.readUInt16BE(0) !== 0xffd8 || data.readUInt16BE(data.length - 2) !== 0xffd9) fail('The photo is not a valid JPEG.');
  // Require a bounded JPEG frame; never trust the filename or declared MIME type.
  let dimensions = null;
  for (let offset = 2; offset + 4 < data.length;) {
    if (data[offset] !== 0xff) break;
    const marker = data[offset + 1], length = data.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > data.length || marker === 0xda) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) {
      dimensions = { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) }; break;
    }
    offset += 2 + length;
  }
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 1600 || dimensions.height > 1600) fail('Resize the photo with the photo picker before saving.');
  const id = createHash('sha256').update(data).digest('hex');
  const name = text(input.name || 'cat-photo.jpg', 'photo name', 120);
  if (!store.db.prepare('SELECT id FROM care_photos WHERE id = ?').get(id)) {
    const used = store.db.prepare('SELECT COALESCE(SUM(length(data)), 0) AS bytes FROM care_photos').get().bytes;
    if (used + data.length > 32 * 1024 * 1024) fail('This exercise has reached its 32 MB photo limit. Export the evidence before resetting.', 409);
    store.db.prepare('INSERT INTO care_photos (id, data) VALUES (?, ?)').run(id, data);
  }
  return { id, name, size: data.length, ...dimensions, url: `/api/care-demo/photos/${id}` };
}
