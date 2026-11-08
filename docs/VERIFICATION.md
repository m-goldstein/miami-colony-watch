# Verification evidence

Checked locally on November 7, 2026. These results cover software, a virtual serial device, firmware simulation, and target compilation. No physical station has been flashed, field-calibrated, or installed by this task.

## Verified story

A fictional batch of messages, illustrative photos, location and clinic notes enters the rescue inbox. Human reviews link stable cat identities and aliases, create distinct identities only when justified, assign care, and retain dated visit/procedure evidence for reporting. The Arduino contributes a separate sensor-to-care path: firmware, USB gateway, authenticated storage, inspection work, and caregiver follow-through.

| Boundary | Evidence |
| --- | --- |
| Firmware processing and OLED | `npm run test:firmware` runs the actual sketch against GPIO/display mocks. Confirms median filtering, no-echo handling, three-detent page changes, wrap, eight text rows, browser/saved acknowledgements, HELLO/STREAM/SAMPLE replies, invalid-command recovery, and compatibility with the browser frame parser. |
| Firmware JSON → API | The same test takes the sketch's emitted JSON through `frameToPacket` and the real HTTP delivery function. A provisioned station stores 20cm as 40% fill, then stores missing echo as an unknown estimate. |
| USB serial driver → retry queue → API | `test/serial.test.js` creates a Linux virtual serial port using Python PTY, runs the actual Node gateway/SerialPort driver, and observes accepted readings and serial acknowledgements. During a simulated HTTP 503 outage the reading remains in the outbox; recovery stores exactly two total readings and empties the queue. |
| API → SQLite and rules | `npm test`: 32 passing tests. Existing ingestion, identity, rules, persistence, weather, food planning and serial checks pass. Seven added rescue tests cover repeat import/review, aliases and census stability, rejected duplicate identities, care/visit evidence, dated procedure reporting, CSV sources/references, transaction rollback, exercise persistence, hardware-only restrictions, and reset isolation. |
| Direct browser ↔ serial device | `npm run test:serial-browser`: guided preview scenarios, isolated demo visits, real caregiver visit persistence, and mocked native Web Serial streams with the local API; checks user-gesture port selection, chooser cancellation, busy-port recovery, live sensor/encoder cards, fragmented data, command round trips, malformed-frame recovery, manual authenticated saves and duplicate replay, null echoes, JSONL download, mobile layout, unplug/reconnect, and unsupported-browser guidance. |
| Browser forms → API → stored record → UI | `npm run test:browser`: desktop and 390px mobile rendering; no console/page errors; simulated no-echo shows Unknown; visit persists without changing food/census; new identity creates review work; task assignment persists; station provision → authenticated telemetry → visible 80% fill; reload retains state. |
| Colony preparedness → API → SQLite → browser reload | `npm run test:planning-browser`: South Point Park context, weather exercises independent of sensors, readiness/people/supply saving and reload, packing shortfall, actual downloaded handoff contents, NWS response rendering, unavailable-alert labeling, physical/demo boundaries, and no horizontal overflow at 320/390/768/1024/1440px. A deterministic NWS fixture covers the browser flow; a real NWS request also returned six forecast periods and available alerts during this task. |
| Field source → reviewed identity → assigned care → dated report | `npm run test:rescue-browser`: two sightings/one identity, a retained alias and both sources, Pippa's care assignment and visit, a distinct new cat, checked procedure evidence, CSV contents, persisted reload, separate sensor/task outcomes, phone-note review on mobile, partial pilot-budget assumptions, five viewport widths, and reset preserving existing workspace records. |
| Client assets | `npm run build` packages the AngularJS client, styles, icon, and locally served vendor script into `dist/`. |
| MCU target | Arduino CLI builds for Uno R3 and classic Nano/old bootloader, plus Uno with `ENABLE_OLED=0`. |

Additional cat-centered front-page screenshots are `test-results/colony-home-desktop.png`, `test-results/colony-home-mobile.png`, and `test-results/colony-storm-desktop.png`. Browser screenshots are generated in ignored `test-results/dashboard-desktop.png`, `test-results/dashboard-mobile.png`, `test-results/usb-sensors-desktop.png`, and `test-results/usb-sensors-mobile.png`. Tests use disposable databases and fictional records rather than changing the user's default workspace. Browser serial tests use mocks and never open a real USB device.

The reference-inspired redesign also produces `test-results/colony-dashboard-viewport.png`, `test-results/colony-map-desktop.png`, and `test-results/colony-map-mobile.png`. The browser flow checks the loaded local image, mobile menu, mode-specific counts, pin selection, all map care filters, unavailable saved readings, map/USB separation, refresh, selected-colony deep linking into the actual visit form, and map updates after accepted live saves. The compact map header expands and collapses on desktop and mobile; Escape restores the preview and focus, selection survives collapse, and live USB readings continue while toggling the map.

The climate-preparedness composition is captured in `test-results/planning-desktop.png`, `test-results/planning-viewport.png`, `test-results/planning-mobile.png`, `test-results/planning-mobile-viewport.png`, and `test-results/weather-outlook.png`. The photo's inherited aspect ratio initially caused phone overflow; the corrected sizing passed the five viewport checks. Existing workspace and mocked USB browser flows also passed after the reorganization.

The Bonus review branch adds `test-results/rescue-desktop.png`, `test-results/rescue-viewport.png`, `test-results/rescue-inbox.png`, `test-results/rescue-mobile.png`, and `test-results/rescue-mobile-viewport.png`. The complete rescue browser flow passed. A test caught missing clinic-reference fields in the initial CSV; the export now retains reference, occurrence date, recording date and original source words. Sensor browser tests now wait for the persistent scenario acknowledgement before checking the resulting state. Weather/planning, mocked USB, and existing field-workspace browser suites also pass.

## Target resource usage

| Build | Flash | Static SRAM |
| --- | --- | --- |
| Uno, OLED enabled | 12,110 bytes / 32,256 (37%) | 590 / 2,048 (28%) |
| Classic Nano, OLED enabled | 12,110 bytes / 30,720 (39%) | 590 / 2,048 (28%) |
| Uno, OLED disabled | 6,338 bytes / 32,256 (19%) | 331 / 2,048 (16%) |

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
