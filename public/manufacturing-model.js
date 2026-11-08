// A design-study estimate, not an orderable quote or a released PCB BOM.
export const RESEARCH_DATE = '2026-11-08';
export const SOURCES = {
  esp: { name: 'Espressif · ESP32-S3 modules', url: 'https://www.espressif.com/en/products/modules?id=ESP32-S3', note: 'Module family and reference sample pricing. The $3.50 line below is a planning allowance.' },
  sht: { name: 'DigiKey · Sensirion SHTC3', url: 'https://www.digikey.com/en/products/detail/sensirion-ag/SHTC3-TR-2-5KS/8628148', note: 'Public USD Digi-Reel price breaks: $2.15 at 1, $1.906 at 5, $1.816 at 10, $1.571 at 100, $1.38772 at 1,000, plus a $7 reeling fee per order included below. A bare IC, not an outdoor probe.' },
  sonar: { name: 'DFRobot · A02YYUW', url: 'https://www.dfrobot.com/product-1935.html', note: 'Public USD single-unit reference $15.90. The sensor is IP67; this does not rate the whole station.' },
  rfid: { name: 'Priority 1 Design · animal-tag reader', url: 'https://www.priority1design.com.au/shopfront/index.php?main_page=product_info&products_id=10', note: 'Protocol and reader/antenna capability reference. The USD $45 reader budget is our allowance, not a converted or confirmed supplier quote.' },
  rfidData: { name: 'Reader datasheet · UART and power', url: 'https://www.priority1design.com.au/rfidrw-e-ttl.pdf', note: 'FDX-B/HDX support, 3.3 V / 5 V serial options, external coil, 5.5–15 V supply. Antenna geometry needs validation.' },
  servo: { name: 'Adafruit · feedback metal-gear servo', url: 'https://www.adafruit.com/product/1450', note: 'Public USD: $14.95 at 1–9, $13.46 at 10–99, $11.96 at 100+. Position feedback is not a food-weight measurement.' },
  lora: { name: 'Seeed · Wio-SX1262', url: 'https://www.seeedstudio.com/Wio-SX1262-Wireless-Module-p-5981.html', note: 'Public module reference $4.29. Antenna, host controller and hub/backhaul are additional.' },
  assembly: { name: 'JLCPCB · assembly pricing explained', url: 'https://jlcpcb.com/solutions/pcb-prototype-assembly', note: 'Setup, stencil, placement, extended parts and assembly are separate charges. Our $65 setup and unit assembly figures are allowances, not a factory quote.' },
  pcb: { name: 'JLCPCB · bare-board reference', url: 'https://jlcpcb.com/ads/pcb-prototype', note: 'Advertised prototype offers cover selected bare PCBs, excluding the complete electronics, mechanics, shipping and testing.' },
  espRadio: { name: 'Espressif · Wi-Fi and Bluetooth LE', url: 'https://www.espressif.com/en/products/socs/esp32-s3', note: 'ESP32-S3 already includes 2.4 GHz Wi-Fi and Bluetooth LE. There is no separate Bluetooth-module line in this model.' },
  iso: { name: 'WSAVA · microchip identification', url: 'https://wsava.org/Global-Guidelines/Microchip-Identification-Guidelines/', note: 'ISO FDX-B animal microchips use 134.2 kHz. Reader placement and compatibility matter.' },
  gps: { name: 'AAHA · microchip FAQs', url: 'https://www.aaha.org/resources/pet-microchipping-faqs/', note: 'A microchip provides an identifier to a nearby reader; it is not a GPS tracker.' },
  gateway: { name: 'Semtech · gateway architecture', url: 'https://www.semtech.com/design-support/faq/faq-gateway', note: 'A LoRaWAN concentrator gateway is different from the simpler point-to-point LoRa hub budgeted here.' }
};
export const DEFAULT_BUILD = Object.freeze({ quantity: 100, radio: 'wifi', rfid: false, dispenser: false, outdoorSonar: true,
  stationsPerHub: 10, existingHub: false, setup: 65, development: 1500, freight: 40, contingency: 15 });
export const PRESETS = Object.freeze({
  sense: { label: 'Sense', rfid: false, dispenser: false, radio: 'wifi' },
  care: { label: 'Sense + visits + feed', rfid: true, dispenser: true, radio: 'ble' },
  network: { label: 'Colony network', rfid: true, dispenser: true, radio: 'lora' }
});
const shtPrice = qty => qty >= 1000 ? 1.38772 : qty >= 500 ? 1.43742 : qty >= 100 ? 1.571 : qty >= 50 ? 1.6374 : qty >= 25 ? 1.71 : qty >= 10 ? 1.816 : qty >= 5 ? 1.906 : 2.15;
const servoPrice = qty => qty >= 100 ? 11.96 : qty >= 10 ? 13.46 : 14.95;
const finite = (value, min, max, integer = false) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
export function estimateBuild(input) {
  const c = { ...DEFAULT_BUILD, ...input };
  if (!finite(c.quantity, 1, 10000, true) || !finite(c.stationsPerHub, 1, 100, true) || !['wifi', 'ble', 'lora'].includes(c.radio) ||
    !['rfid', 'dispenser', 'outdoorSonar', 'existingHub'].every(key => typeof c[key] === 'boolean') ||
    !['setup', 'development', 'freight'].every(key => finite(c[key], 0, 1000000)) || !finite(c.contingency, 0, 100)) return null;
  const row = (key, label, unit, group, source, basis = 'Engineering allowance') => ({ key, label, unit, group, source, basis, extended: unit * c.quantity });
  const lines = [
    row('mcu', 'ESP32-S3-MINI-1 controller · Wi-Fi + BLE included', 3.50, 'Controller board', 'esp'),
    row('climate', 'SHTC3 temperature / humidity IC', shtPrice(c.quantity), 'Controller board', 'sht', 'Published USD quantity break'),
    row('power', '12 V input protection, 5 V buck, clean 3.3 V and switched outputs', 4.50, 'Controller board', null),
    row('passives', 'Connectors, passives, status LED and test pads', 2.75, 'Controller board', null),
    row('pcb', 'Two-layer FR-4 controller board · minimum 5-board allowance', Math.max(5, c.quantity) * 1.50 / c.quantity, 'Controller board', 'pcb'),
    row('assembly', 'Placement / soldering allowance', 4.00, 'Manufacturing', 'assembly'),
    row('reel', 'SHTC3 Digi-Reel preparation · $7 per batch', 7 / c.quantity, 'Manufacturing', 'sht', 'Published USD reeling fee; one order per batch'),
    row('qa', 'Programming, functional test and calibration allowance', 3.00, 'Manufacturing', null),
    row('sonar', c.outdoorSonar ? 'A02YYUW protected ultrasonic food-level sensor' : 'Sheltered bench ultrasonic sensor + level interface', c.outdoorSonar ? 15.90 : 3.50, 'Sensing', c.outdoorSonar ? 'sonar' : null, c.outdoorSonar ? 'Published single-unit USD reference; no volume discount assumed' : 'Engineering allowance · bench use'),
    row('wetness', 'Replaceable rain plate / base-wetness probes', 3.00, 'Sensing', null),
    row('case', 'Controller enclosure / ventilated sensor mounting', 8.00, 'Enclosure & power', null),
    row('supply', 'External 12 V supply allowance', 9.00, 'Enclosure & power', null),
    row('wiring', 'Cables, strain relief, mounting and seals', 3.00, 'Enclosure & power', null)
  ];
  if (c.rfid) lines.push(row('reader', 'Animal-chip LF reader module, separate from main PCB', 45.00, 'RFID upgrade', 'rfid'), row('coil', 'Antenna adaptation / neck-height loop allowance', 6.00, 'RFID upgrade', 'rfidData'));
  if (c.dispenser) lines.push(row('servo', 'Feedback metal-gear servo', servoPrice(c.quantity), 'Dispenser upgrade', 'servo', 'Published USD quantity break'), row('gate', 'Hopper, guarded gate, return spring and food-contact parts', 12.00, 'Dispenser upgrade', null));
  if (c.radio === 'lora') lines.push(row('lora', 'Wio-SX1262 optional radio module', 4.29, 'Wireless upgrade', 'lora', 'Published single-unit reference; no volume discount assumed'), row('antenna', 'LoRa antenna / connector allowance', 2.00, 'Wireless upgrade', null));
  const partsUnit = lines.reduce((sum, line) => sum + line.unit, 0);
  const hubUnit = c.radio === 'wifi' ? 0 : c.radio === 'ble' ? 35 : 60;
  const hubCount = c.existingHub || c.radio === 'wifi' ? 0 : Math.ceil(c.quantity / c.stationsPerHub);
  const hubTotal = hubCount * hubUnit, setupPerUnit = c.setup / c.quantity, freightPerUnit = c.freight / c.quantity;
  const recurringBuildUnit = partsUnit + setupPerUnit + freightPerUnit + hubTotal / c.quantity;
  const contingencyPerUnit = recurringBuildUnit * c.contingency / 100, developmentPerUnit = c.development / c.quantity;
  const unitTotal = recurringBuildUnit + contingencyPerUnit + developmentPerUnit;
  const boardUnit = lines.filter(line => ['Controller board', 'Manufacturing'].includes(line.group)).reduce((sum, line) => sum + line.unit, 0) + setupPerUnit;
  const groups = [...new Set(lines.map(line => line.group))].map(name => ({ name, amount: lines.filter(line => line.group === name).reduce((sum, line) => sum + line.unit, 0) }));
  groups.push({ name: 'Batch setup + freight / node', amount: setupPerUnit + freightPerUnit }, { name: 'Shared hubs / node', amount: hubTotal / c.quantity },
    { name: 'Contingency / node', amount: contingencyPerUnit }, { name: 'One-time design budget / node', amount: developmentPerUnit });
  return { config: c, lines, groups, boardUnit, partsUnit, hubCount, hubUnit, hubTotal, setupPerUnit, freightPerUnit,
    contingencyPerUnit, developmentPerUnit, recurringBuildUnit, unitTotal, batchTotal: unitTotal * c.quantity,
    exclusion: 'Tax/duties, regulatory testing, further tooling/PCB revisions, site canopy and resting furniture, bowls, food, veterinary microchipping, field visits and ongoing hub/cloud/backhaul costs are not included. Blank assumptions are not supplier quotes.' };
}
export function compareScale(config) {
  if (!estimateBuild(config)) return null;
  return [10, 100, 1000].map(quantity => estimateBuild({ ...config, quantity }));
}
export const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
