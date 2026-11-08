# Verification evidence

Checked locally on November 7, 2026. These results cover software, a virtual serial device, firmware simulation, and target compilation. No physical station has been flashed, field-calibrated, or installed by this task.

## Verified story

A station measures food headspace, wetness, and DHT11 ambient temperature on D7. Its firmware emits a bounded JSON record; the USB gateway adds identity/time and queues it; an authenticated API validates and stores it; the task evaluator creates inspection work; the dashboard displays the data alongside caregiver visits and cat/TNVR records.

| Boundary | Evidence |
| --- | --- |
| Firmware processing and OLED | `npm run test:firmware` runs the actual sketch against GPIO/display mocks. Confirms median filtering, no-echo handling, three-detent page changes, wrap, eight text rows on all five pages, DHT11 startup/two-second sampling, invalid-read clearing and recovery, heat/cold/freezing LED priorities, browser/saved acknowledgements, HELLO/STREAM/SAMPLE replies, invalid-command recovery, and compatibility with the browser frame parser. |
| Firmware JSON → API | The same test takes the sketch's emitted JSON through `frameToPacket` and the real HTTP delivery function. A provisioned station stores 20cm as 40% fill, then stores missing echo as an unknown estimate. DHT11 temperatures of 26°C, null, 36°C, 5°C, and −2°C pass through the same path and create distinct heat/cold/freezing tasks. |
| USB serial driver → retry queue → API | `test/serial.test.js` creates a Linux virtual serial port using Python PTY, runs the actual Node gateway/SerialPort driver, and observes accepted readings and serial acknowledgements. During a simulated HTTP 503 outage the reading remains in the outbox; recovery stores exactly two total readings and empties the queue. |
| API → SQLite and rules | `npm test`: 29 passing tests, including ingestion auth, schema/time bounds, idempotent replay, reboot sessions, old backlog ordering, task deduplication, human visits, stable identities, TNVR evidence, live/demo restrictions, provisioning checks, SQLite/outbox persistence, Web Serial protocol/transport checks, temperature threshold boundaries, legacy thermometer-free packets, invalid/stale/disconnected temperature handling, thermal task deduplication, saved-map freshness/calibration priorities, food packing estimates, NWS caching/failure handling, and preparedness validation/persistence. |
| Direct browser ↔ serial device | `npm run test:serial-browser`: guided preview scenarios, isolated demo visits, real caregiver visit persistence, and mocked native Web Serial streams with the local API; checks user-gesture port selection, chooser cancellation, busy-port recovery, live sensor/encoder cards, fragmented data, command round trips, malformed-frame recovery, manual authenticated saves and duplicate replay, thermal care checks and map temperatures, OLED temperature-page frames, missing/stale temperature, non-overlapping temperature text at 320/390px, null echoes, JSONL download, mobile layout, unplug/reconnect, and unsupported-browser guidance. |
| Browser forms → API → stored record → UI | `npm run test:browser`: desktop and 390px mobile rendering; no console/page errors; heat/cold/freezing scenarios update saved station labels; simulated no-echo shows Unknown; visit persists without changing food/census; new identity creates review work; task assignment persists; station provision → authenticated telemetry → visible 80% fill; reload retains state. |
| Colony preparedness → API → SQLite → browser reload | `npm run test:planning-browser`: South Point Park context, weather exercises independent of sensors, readiness/people/supply saving and reload, packing shortfall, actual downloaded handoff contents, NWS response rendering, unavailable-alert labeling, physical/demo boundaries, and no horizontal overflow at 320/390/768/1024/1440px. A deterministic NWS fixture covers the browser flow; a real NWS request also returned six forecast periods and available alerts during this task. |
| Client assets | `npm run build` packages the AngularJS client, styles, icon, and locally served vendor script into `dist/`. |
| MCU target | Arduino CLI builds for Uno R3 and classic Nano/old bootloader, plus Uno with `ENABLE_OLED=0`. |

Additional cat-centered front-page screenshots are `test-results/colony-home-desktop.png`, `test-results/colony-home-mobile.png`, and `test-results/colony-storm-desktop.png`. Browser screenshots are generated in ignored `test-results/dashboard-desktop.png`, `test-results/dashboard-mobile.png`, `test-results/usb-sensors-desktop.png`, and `test-results/usb-sensors-mobile.png`. Tests use disposable databases and fictional records rather than changing the user's default workspace. Browser serial tests use mocks and never open a real USB device.

The reference-inspired redesign also produces `test-results/colony-dashboard-viewport.png`, `test-results/colony-map-desktop.png`, and `test-results/colony-map-mobile.png`. The browser flow checks the loaded local image, mobile menu, mode-specific counts, pin selection, all map care filters, unavailable saved readings, map/USB separation, refresh, selected-colony deep linking into the actual visit form, and map updates after accepted live saves. The compact map header expands and collapses on desktop and mobile; Escape restores the preview and focus, selection survives collapse, and live USB readings continue while toggling the map.

The climate-preparedness composition is captured in `test-results/planning-desktop.png`, `test-results/planning-viewport.png`, `test-results/planning-mobile.png`, `test-results/planning-mobile-viewport.png`, and `test-results/weather-outlook.png`. The photo's inherited aspect ratio initially caused phone overflow; the corrected sizing passed the five viewport checks. Existing workspace and mocked USB browser flows also passed after the reorganization.

Temperature alert screenshots: `test-results/temperature-heat-desktop.png` and `test-results/temperature-heat-mobile.png`. Builds use Arduino AVR 1.8.8, SSD1306Ascii 1.3.5, DHT sensor library 1.4.7, and Adafruit Unified Sensor 1.1.15. DHT hardware and its pulse timings are mocked in host tests; actual Uno/Nano builds use the real libraries.

## Target resource usage

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
- The direct dashboard keeps demo and live histories separate, has no automatic uploads or durable browser queue, and only saves live readings to the workspace on explicit request. Preview visits stay in tab memory; linked live caregiver visits use the existing visit API. It requires a supported browser on localhost/HTTPS and exclusive ownership of the USB serial port.
- Coordinator APIs trust the local computer. There is no public-user authentication, role-based location access, or external notification delivery.
- `npm audit` reports one high-severity dependency entry for the explicitly requested, unsupported `angular@1.8.3`; no package fix is available. No claim is made that the audit is clean. Resolve the framework choice before public hosting.
- No cloud database, Vercel deployment, or real colony rollout has been created. Source publication to GitHub does not deploy the application. The deployment document is a migration/runbook, not evidence of production readiness.
