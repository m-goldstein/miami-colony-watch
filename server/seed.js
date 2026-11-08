import { DEFAULT_CALIBRATION, hashKey } from './domain.js';

export function seedDemo(store) {
  if (store.list('colonies').length) {
    // Retain the stable demo identity, visits, and hardware history on older local installs.
    const old = store.get('colonies', 'col-mangrove');
    if (old?.demo && old.name === 'Mangrove Mews') store.put('colonies', { ...old, name: 'South Point Park', neighborhood: 'South Beach', mapX: 78, mapY: 57 });
    return;
  }
  const now = Date.now();
  const specs = [
    ['mangrove', 'South Point Park', 'South Beach', 'Elena', 14, 11, 78, 57, 18, false, 130],
    ['banyan', 'Banyan Corner', 'Little Havana', 'Marco', 18, 15, 34, 51, 72, false, 100],
    ['rail', 'Railway Garden', 'Little Haiti', 'Lucía', 11, 7, 58, 21, 42, true, 690],
    ['palm', 'Palm Courtyard', 'Allapattah', 'Nico', 9, 8, 36, 29, 86, false, 95],
    ['bay', 'Bay Hammock', 'Coconut Grove', 'Sofía', 12, 10, 29, 69, 55, false, 140],
    ['orchid', 'Orchid Landing', 'Homestead', 'Adrián', 16, 9, 21, 89, 34, false, 115]
  ];
  const names = ['Mango', 'Luna', 'Pepper', 'Coco', 'Miso', 'Sol', 'Olive', 'Cleo'];
  const coats = ['gray tabby, white chin', 'black coat, green eyes', 'orange tabby, white paws', 'calico, small build', 'tuxedo, white chest', 'cream coat, dark ears'];
  store.transaction(() => {
    specs.forEach(([slug, name, neighborhood, caretaker, cats, fixed, mapX, mapY, food, wet, water], index) => {
      const colonyId = `col-${slug}`, deviceId = `CW-${String(index + 1).padStart(3, '0')}`;
      store.put('colonies', { id: colonyId, name, neighborhood, caretaker, mapX, mapY, demo: true,
        notes: 'Fictional pilot colony. Locations are neighborhood-level illustrations only.',
        lastVisitAt: new Date(now - (index + 1) * 45 * 60000).toISOString(),
        sitePermission: true, stormPlan: index < 4 ? 'Backup feeder assigned; inspect raised shelter before storms.' : 'Assign a backup feeder and confirm higher-ground access.' });
      const lastSeenAt = new Date(now - (index === 5 ? 95 * 60000 : 20000)).toISOString();
      const device = { id: deviceId, colonyId, name: `Station ${String(index + 1).padStart(2, '0')}`, demo: true,
        lifecycle: 'deployed', simulationOffline: index === 5, calibration: { ...DEFAULT_CALIBRATION }, firmwareVersion: 'colony-monitor/1.0',
        lastSeenAt, installedAt: new Date(now - (14 + index) * 86400000).toISOString(),
        sitePermission: true, benchPassed: true, weatherProtected: true, keyHash: hashKey('demo-local-only-key') };
      store.put('devices', device);
      for (let sample = 0; sample < 16; sample++) {
        const sampledAt = new Date(Date.parse(lastSeenAt) - (15 - sample) * 30 * 60000).toISOString();
        const level = Math.min(100, food + (15 - sample) * 2.1);
        store.addReading({ schemaVersion: 1, deviceId, bootId: 'seed-demo-v1', sequence: sample, uptimeMs: sample * 30000,
          sampledAt, sonarDistanceCm: +(30 - level * 0.25).toFixed(1), sonarValidSamples: 5,
          rainAnalog: wet ? 230 : 920, rainDigital: wet ? 0 : 1, waterAnalog: water, temperatureC: 26 + index * 0.5, source: 'demo' }, sampledAt);
      }
      for (let cat = 0; cat < cats; cat++) {
        store.put('cats', { id: `${slug}-cat-${String(cat + 1).padStart(2, '0')}`, colonyId,
          name: cat < 8 ? names[(cat + index) % names.length] : `${neighborhood.split(' ')[0]} ${cat + 1}`,
          description: coats[(cat + index) % coats.length], tnvrStatus: cat < fixed ? 'confirmed' : 'needed',
          health: cat === cats - 1 && index === 2 ? 'needs attention' : 'observed well',
          lastSeenAt: new Date(now - (cat % 3 + 1) * 3600000).toISOString(), demo: true });
      }
    });
    store.put('tasks', { id: 'task-tnvr-demo', colonyId: 'col-mangrove', title: 'Plan TNVR for three unconfirmed cats',
      type: 'tnvr', severity: 'warning', status: 'assigned', assignee: 'Elena', origin: 'volunteer',
      createdAt: new Date(now - 3600000).toISOString(), updatedAt: new Date(now - 3600000).toISOString() });
    store.put('observations', { id: 'obs-demo', colonyId: 'col-rail', catId: 'rail-cat-11',
      text: 'Fictional feeder update: cat favoring a front paw. Request an experienced caregiver review.',
      author: 'Lucía', createdAt: new Date(now - 30 * 60000).toISOString(), source: 'phone form' });
  });
}
