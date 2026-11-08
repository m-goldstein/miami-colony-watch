# ColonyWatch edge-node design study

Review branch: `review/bonus-cat-care`, separate worktree `miami-colony-watch-judges`. The original checkout and service remain untouched.

Open `/manufacturing.html` after `npm run review` (port 3001). The homepage’s **The next little station** section contains three persisted concept tiles: animal-chip visits, a bounded food gate, and a shared wireless hub. These additions illustrate a possible next device; they do not connect to USB, a motor, an RFID reader or a radio. Current Arduino firmware and its DHT11 temperature path are unchanged. Current firmware does not report humidity.

## Demonstrate the concept

1. Read Mango’s fictional chip twice. Two raw reads become one visit and one unique linked cat. **Return after 3 min** creates another visit while retaining one visitor. The session rule is a two-minute gap since the last read, not a two-minute window since arrival.
2. Choose the unlinked example chip. A caregiver must associate it with an existing exercise identity. Neither reading a chip nor making that association adds to the census or the real care report. Multiple chip tokens mapped to one identity still count as one cat.
3. Request a 5–30 g mock portion. The record retains requested grams, a null delivered weight, and `physicalActuation: false`. Each request has an idempotency key. A 30-second cooldown prevents another cycle. **Advance clock** moves the concept clock by one minute without waiting. A simulated jam latches inhibition until manual inspection is recorded.
4. Take the mock hub offline. Reader and gate events remain queued in the exercise. Select Wi-Fi, BLE or LoRa to inspect the proposed path. Reconnect and sync; packet identities are acknowledged once. Replaying the same identities does not add to the acknowledged total.
5. Reload to verify persistence. **Reset exercise** resets these concept events along with the existing fictional care exercise after its normal explicit confirmation. Hardware-only mode refuses all concept endpoints.

The concept clock can be advanced independently of real time and is labeled fictional. All chip tokens and associations are synthetic. No raw chip identifiers, registry data or real cat location are collected. The simulated replay is a demonstration of intended acknowledgment semantics, not an implemented physical radio protocol.

## Manufacturing page

The page includes four native, editable SVG figures: mock carrier PCB placement, functional interfaces and power rails, guarded feeder geometry, and a shared-hub network. Regenerate them with `python3 scripts/generate-hardware-figures.py`. These are not a schematic, KiCad layout, Gerbers or fabrication deliverables. Pin assignments and electrical / mechanical checks remain future engineering.

The intended architecture is an ESP32-S3-MINI-1 carrier with built-in Wi-Fi / Bluetooth LE, a remote SHTC3 temperature / humidity probe, food-level sonar, replaceable wetness probes, separate animal-chip UART reader, feedback servo and optional SX1262 radio. The LF reader, coil, motor and sonar are external. Use protected 12 V input for the reference reader, separate 5 V actuator regulation and clean 3.3 V logic. Size power from measured peaks and stall current. A spring-biased gate is a design target requiring validation; a hobby servo alone cannot promise closure after power loss.

Use a verified 134.2 kHz ISO 11784/11785 FDX-B animal-chip reader, not an RC522 / NFC module. Verify support for any older regional chip formats. Close-pass read coverage depends on coil geometry, orientation, metal and interference; it is not GPS or a registry identity service. The point-to-point LoRa bridge budget is not a LoRaWAN concentrator or a cellular gateway. ESP32 BLE and Wi-Fi do not require buying another controller module.

## Default planning assumptions

USD component references checked November 8, 2026. The page links the primary supplier / manufacturer references beside the relevant claims and each sourced BOM row. Published prices are mixed with explicitly labeled engineering allowances, not presented as a factory quote. The reader’s $45 USD allowance is not a currency conversion of its vendor’s displayed price.

At 100 stations with protected sonar, $65 batch setup, $40 batch freight, a $1,500 one-time design budget, ten stations per new hub and 15% build contingency:

| Configuration | Controller PCBA / node | Complete allocated station | Complete batch |
| --- | ---: | ---: | ---: |
| Sensing, existing Wi-Fi | $21.47 | $84.89 | $8,488.67 |
| Sensing + visits + gate, BLE hubs | $21.47 | $175.12 | $17,511.57 |
| Sensing + visits + gate, LoRa hubs | $21.47 | $185.22 | $18,522.42 |

The PCBA subtotal includes the climate IC within the sensing assembly, bare board, assembly, functional test and allocated setup. It excludes the other external sensors, reader, mechanism, enclosure, power, hubs, freight, design budget and contingency. Its physical climate IC belongs on a thermally isolated probe; the placement figure shows the external I²C connection. Connector / passive and board allowances must cover that probe carrier when the actual assembly is quoted. The complete station total includes all selected items and allocations. Only SHTC3 / servo published price breaks and amortized batch costs improve automatically with quantity; other wholesale discounts are not invented. Small runs include a minimum five-PCB allowance. Shared hubs round up to whole devices.

Formula:

```
build basis = selected components + manufacturing + setup + freight + new shared hubs
complete batch = build basis × (1 + contingency %) + one-time design budget
allocated cost per node = complete batch / node count
```

Quantity, radio, upgrades, hub ownership / sharing, setup, freight, development and contingency are editable. The pure model is `public/manufacturing-model.js`; line allowances can be adjusted there. Valid preferences stay only in browser storage; invalid inputs clear totals and disable downloads. BOM CSV and build-brief JSON retain assumptions, unrounded costs, price bases, exclusions and source references. Print / save PDF includes the current estimate and diagrams.

Tax / duties, regulatory certification, further tooling or PCB revisions, solar / batteries, food, veterinary microchipping, field labor, ongoing cloud / hub / backhaul service and actual procurement quotes remain outside the total. The design allowance is a placeholder contribution, not a fixed-price production engineering service. The page explains these limits and a path from bench validation through a supervised pilot.

## Data and verification

`POST /api/care-demo/concept` changes only the `edgeConcept` subrecord of the isolated fictional exercise. Version-three migration adds empty concept state without resetting previous reviews, plans or temperature evidence. The live API, firmware, serial transport, physical workspace and original database are unaffected. Invalid operations roll back transactionally.

`npm test` covers visit grouping, identity counts, manual linking, input validation, gate idempotency / cooldown / jam, unknown delivered weight, queue acknowledgments / replay, migrations, hardware-only refusal and physical-data isolation. Cost-model tests reconcile complete totals, price breaks, optional equipment, hub allocation and invalid inputs.

`npm run test:hardware-browser` exercises the complete tiles and calculator, reload persistence, downloads, all four diagrams, printable output and 320–1440 px layouts. Screenshots and sample exports go to ignored `test-results/`. Existing rescue, planning, serial and workspace browser suites verify that the new UI retains their flows.
