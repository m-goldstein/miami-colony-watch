# Verification evidence

The November 7, 2026 checks below cover software, a virtual serial device, firmware simulation, and target compilation. The November 8 connected-device check adds physical USB telemetry and a verified Uno firmware upload. Field calibration and installation remain unverified.

## Connected Uno and OLED refresh — November 8, 2026

The Arduino Uno at `/dev/ttyACM0` reported `colony-monitor/1.2` over its actual USB serial connection at 115200 baud. Three requested samples at 20:51:28–20:51:38 UTC passed the shared browser frame parser. After uploading firmware 1.3 with upload verification, its boot and HELLO replies confirmed the new version, and two further samples at 20:54:04 and 20:54:08 UTC passed both the browser parser and gateway/API packet validation.

| Measurement | Connection | Live observations |
| --- | --- | --- |
| Food headspace, HC-SR04 | TRIG D5 / ECHO D6 | 18.3 cm before upload; 22.8 cm afterward; 5/5 valid echoes. Default calibration estimated 46% and 28% fill respectively; the hopper geometry was not calibrated in this check. |
| Rain/surface wetness | DO A0 / AO A1 | Digital 1, analog 1022–1023: dry under the configured active-low comparator. |
| Standing-water probe | A2 | Analog 0–1, normalized wetness index 0. |
| Ambient temperature, DHT11 | D7 | 23.4°C in all five valid samples. |

These observations confirm live telemetry for four implemented measurement channels. The rain and water observations are baseline ADC/comparator readings; a controlled dry/wet response was not tested, so they do not establish probe connectivity or sensitivity. Humidity is not sampled. RFID/microchip visits, the motorized gate, Wi-Fi/BLE/LoRa, and the proposed SHTC3 probe remain concepts. The running review API and both local databases contained only fictional demo stations, with no saved physical-device readings.

The OLED previously cleared and repainted its entire display every 250 ms. Firmware 1.3 instead caches its 21×8 text cells and updates only changed character runs at fixed positions. Spaces erase leftover digits, scrolling is explicitly disabled, and a display reconnect invalidates the cache. The refresh interval and encoder navigation remain the same. Host tests check zero OLED writes for an unchanged frame, only two character writes when `900` becomes `9`, no refresh/page-change clears, bounded cursor positions, and redraw after an I²C timeout. Visual confirmation on the physical OLED is still needed.

`npm run test:firmware` and all 46 `npm test` cases passed. The Uno build uses 15,332 / 32,256 bytes of flash and 823 / 2,048 bytes of static SRAM. The verified upload succeeded. The final capture received two valid readings and a malformed frame. Afterward, Chrome owned the same serial port, and a subsequent attempt reported it busy; competing readers may explain the malformed frame. Chrome's connection was left undisturbed. USB telemetry was not written into the real workspace. Local capture evidence is saved under ignored `test-results/device-validation-*.json`.

## Verified story

A fictional batch of messages, illustrative photos, location and clinic notes enters the rescue inbox. Human reviews link stable cat identities and aliases, create distinct identities only when justified, assign care, and retain dated visit/procedure evidence for reporting. The Arduino contributes a separate sensor-to-care path: DHT11 temperature on D7, firmware, USB gateway, authenticated storage, inspection work, and caregiver follow-through.

| Boundary | Evidence |
| --- | --- |
| Firmware processing and OLED | `npm run test:firmware` runs the actual sketch against GPIO/display mocks. Confirms median filtering, no-echo handling, three-detent page changes, wrap, eight text rows on all five pages, DHT11 startup/two-second sampling, invalid-read clearing and recovery, heat/cold/freezing LED priorities, browser/saved acknowledgements, HELLO/STREAM/SAMPLE replies, invalid-command recovery, and compatibility with the browser frame parser. |
| Firmware JSON → API | The same test takes the sketch's emitted JSON through `frameToPacket` and the real HTTP delivery function. A provisioned station stores 20cm as 40% fill, then stores missing echo as an unknown estimate. DHT11 temperatures of 26°C, null, 36°C, 5°C, and −2°C pass through the same path and create distinct heat/cold/freezing tasks. |
| USB serial driver → retry queue → API | `test/serial.test.js` creates a Linux virtual serial port using Python PTY, runs the actual Node gateway/SerialPort driver, and observes accepted readings and serial acknowledgements. During a simulated HTTP 503 outage the reading remains in the outbox; recovery stores exactly two total readings and empties the queue. |
| API → SQLite and rules | `npm test`: 38 passing tests. Temperature thresholds, legacy frames, stale readings and thermal alerts pass alongside existing ingestion, identity, rules, persistence, weather, food planning and serial checks pass. Nine added rescue tests cover repeat import/review, aliases and census stability, rejected duplicate identities, care/visit evidence, dated procedure reporting, CSV sources/references, transaction rollback, exercise persistence, hardware-only restrictions, reset isolation, persistent thermal follow-ups, thermal CSV evidence, and migration of older exercises without invented temperature data. |
| Direct browser ↔ serial device | `npm run test:serial-browser`: guided preview scenarios, isolated demo visits, real caregiver visit persistence, and mocked native Web Serial streams with the local API; checks user-gesture port selection, chooser cancellation, busy-port recovery, live sensor/encoder cards, fragmented data, command round trips, malformed-frame recovery, manual authenticated saves and duplicate replay, thermal care checks and map temperatures, OLED temperature-page frames, missing/stale temperature, non-overlapping temperature text at 320/390px, null echoes, JSONL download, mobile layout, unplug/reconnect, and unsupported-browser guidance. |
| Browser forms → API → stored record → UI | `npm run test:browser`: desktop and 390px mobile rendering; no console/page errors; heat/cold/freezing scenarios update saved station labels; simulated no-echo shows Unknown; visit persists without changing food/census; new identity creates review work; task assignment persists; station provision → authenticated telemetry → visible 80% fill; reload retains state. |
| Colony preparedness → API → SQLite → browser reload | `npm run test:planning-browser`: South Point Park context, weather exercises independent of sensors, readiness/people/supply saving and reload, packing shortfall, actual downloaded handoff contents, NWS response rendering, unavailable-alert labeling, physical/demo boundaries, and no horizontal overflow at 320/390/768/1024/1440px. A deterministic NWS fixture covers the browser flow; a real NWS request also returned six forecast periods and available alerts during this task. |
| Field source → reviewed identity → assigned care → dated report | `npm run test:rescue-browser`: two sightings/one identity, a retained alias and both sources, Pippa's care assignment and visit, a distinct new cat, checked procedure evidence, CSV contents, persisted reload, separate sensor/task outcomes, phone-note review on mobile, partial pilot-budget assumptions, five viewport widths, and reset preserving existing workspace records. |
| Client assets | `npm run build` packages the AngularJS client, styles, icon, and locally served vendor script into `dist/`. |
| MCU target | Arduino CLI builds for Uno R3 and classic Nano/old bootloader, plus Uno with `ENABLE_OLED=0`. |

Additional cat-centered front-page screenshots are `test-results/colony-home-desktop.png`, `test-results/colony-home-mobile.png`, and `test-results/colony-storm-desktop.png`. Browser screenshots are generated in ignored `test-results/dashboard-desktop.png`, `test-results/dashboard-mobile.png`, `test-results/usb-sensors-desktop.png`, and `test-results/usb-sensors-mobile.png`. Tests use disposable databases and fictional records rather than changing the user's default workspace. Browser serial tests use mocks and never open a real USB device.

The reference-inspired redesign also produces `test-results/colony-dashboard-viewport.png`, `test-results/colony-map-desktop.png`, and `test-results/colony-map-mobile.png`. The browser flow checks the loaded local image, mobile menu, mode-specific counts, pin selection, all map care filters, unavailable saved readings, map/USB separation, refresh, selected-colony deep linking into the actual visit form, and map updates after accepted live saves. The compact map header expands and collapses on desktop and mobile; Escape restores the preview and focus, selection survives collapse, and live USB readings continue while toggling the map.

The climate-preparedness composition is captured in `test-results/planning-desktop.png`, `test-results/planning-viewport.png`, `test-results/planning-mobile.png`, `test-results/planning-mobile-viewport.png`, and `test-results/weather-outlook.png`. The photo's inherited aspect ratio initially caused phone overflow; the corrected sizing passed the five viewport checks. Existing workspace and mocked USB browser flows also passed after the reorganization.

The Bonus review branch adds `test-results/rescue-desktop.png`, `test-results/rescue-viewport.png`, `test-results/rescue-inbox.png`, `test-results/rescue-mobile.png`, and `test-results/rescue-mobile-viewport.png`. The complete rescue browser flow passed. A test caught missing clinic-reference fields in the initial CSV; the export now retains reference, occurrence date, recording date and original source words. Sensor browser tests now wait for the persistent scenario acknowledgement before checking the resulting state. Weather/planning, mocked USB, and existing field-workspace browser suites also pass.

Temperature alert screenshots: `test-results/temperature-heat-desktop.png` and `test-results/temperature-heat-mobile.png`. Builds use Arduino AVR 1.8.8, SSD1306Ascii 1.3.5, DHT sensor library 1.4.7, and Adafruit Unified Sensor 1.1.15. DHT hardware and its pulse timings are mocked in host tests; actual Uno/Nano builds use the real libraries.

## Earlier target resource usage (firmware 1.2)

| Build | Flash | Static SRAM |
| --- | --- | --- |
| Uno, OLED enabled | 14,802 bytes / 32,256 (45%) | 616 / 2,048 (30%) |
| Classic Nano, OLED enabled | 14,802 bytes / 30,720 (48%) | 616 / 2,048 (30%) |
| Uno, OLED disabled | 8,778 bytes / 32,256 (27%) | 357 / 2,048 (17%) |

The Arduino AVR core emits its existing unused-parameter warnings in `new.cpp` on a fresh core build; the monitoring sketch compiles successfully. Node 22 emits its documented experimental SQLite warning.

## Known limitations

- Physical sensor wiring, target geometry, kibble repeatability, real weather exposure, enclosure safety, probe corrosion/drift, power, and real connectivity must be validated at the bench and during a supervised pilot.
- Linux PTY testing verifies the software serial path; it does not verify a specific USB cable, board, sensor, or outdoor installation.
- Temperature, humidity, rainfall rate, drinking-water quality, cat counts, and food consumption are not inferred from this kit. The rain/water views report local wetness and the food view reports approximate hopper fill.
- A running gateway buffers network outages; a stopped gateway or unpowered Uno cannot reconstruct unrecorded serial data. The outbox has no automatic disk limit or expired-message deletion.
- The direct dashboard keeps demo and live histories separate, has no automatic uploads or durable browser serial queue, and only saves live readings to the workspace on explicit request. Fictional visits/scenarios/plans persist in the isolated rescue exercise; linked live caregiver visits use the existing visit API. Web Serial requires a supported browser on localhost/HTTPS and exclusive ownership of the USB port.
- Sample suggestions are prepared exercise annotations. No live AI extraction, automatic photo matching, actual chat import, multilingual support or hosted team authentication is claimed. The repeated photo is the existing generated illustrative asset; identities and procedure evidence remain human decisions.
- Coordinator APIs trust the local computer. There is no public-user authentication, role-based location access, or external notification delivery.
- `npm audit` reports one high-severity dependency entry for the explicitly requested, unsupported `angular@1.8.3`; no package fix is available. No claim is made that the audit is clean. Resolve the framework choice before public hosting.
- No cloud database, Vercel deployment, or real colony rollout has been created. Source publication to GitHub does not deploy the application. The deployment document is a migration/runbook, not evidence of production readiness.
