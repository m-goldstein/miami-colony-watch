# Colony Watch — shared care for community cats

The landing page opens with the **colony map**, then **weather and station sensors**, followed by the **colony journal and image classification demo**. Click **Run the colony demo** for a four-step walkthrough. Preview the prepared photo suggestions, open “Stripey” in the journal, and confirm the association with Mango without adding another cat. Photo suggestions are sample annotations, not live image analysis. Journal notes, care visits, and confirmed reviews use the existing saved exercise. Run `npm run test:demo-browser` to verify this flow and its mobile layouts.

This review branch leads with the Bonus hackathon challenge: scattered field updates become a trustworthy cat census, assigned care, documented visits, and an evidence-backed report. South Point Park is the fictional example, with 14 baseline cats and 11 historical TNVR confirmations. The Arduino’s food, wetness, and DHT11 temperature readings contribute to the same care story.

**Review branch:** `review/bonus-cat-care`, in the separate `miami-colony-watch-judges` worktree. The original checkout, running site, and database remain unchanged. [Review instructions and demo walkthrough](docs/BONUS_REVIEW.md).

**Next-device design:** the homepage now includes conceptual microchip visits, a guarded food-gate simulator and an offline hub queue. **Build costs** at `/manufacturing.html` adds four editable hardware diagrams, Wi-Fi / BLE / LoRa options, an adjustable manufacturing budget, BOM / brief downloads and printable output. These features simulate proposed equipment; the working Arduino temperature demo remains intact. [Architecture, assumptions and walkthrough](docs/EDGE_NODE_DESIGN.md).

The original component-test sketch remains unchanged in the neighboring `pins_layout/` directory. Monitoring firmware lives in this project's `firmware/colony_monitor/` directory.

## Start locally

Requires **Node.js 22.13+**, npm, and a modern browser. Node's built-in SQLite may print an experimental-feature warning on Node 22.

```bash
cd /home/max/hackathon/DevDayHackathon/miami-colony-watch-judges
npm ci
npm run review
```

Open **http://127.0.0.1:3001**. `npm run review` uses this worktree’s `data/review.sqlite`, so it can run alongside the original website on port 3000. The fictional rescue exercise persists independently inside its `care_demo` record. **Try the rescue story** loads six sample messages, photos, location and clinic notes. Review identities, add an alias, assign a follow-up, document a visit, and export the dated evidence report. Reloading retains your work; Reset exercise clears only this sandbox.

The **field workspace** at **http://127.0.0.1:3001/colonies.html** retains its separate six-colony sample dataset and physical-device tools. **Live Arduino** continues to support direct USB readings; no hardware is required for the rescue exercise. This review has not been pushed or deployed.

The app binds only to `127.0.0.1`. It is a local coordinator workspace, without multi-user authentication. Source control is separate from hosting: the app has not been deployed to Vercel or published as a hosted website.

The separate field-workspace demonstration contains **six fictional colonies, 80 individually recorded cats, and 60 confirmed demo TNVR records**. These are invented pilot records, not Miami population statistics. Names, people, sensor histories, and map locations are clearly labeled fictional. The map is an illustrative neighborhood schematic, not a navigation map.

## Try the rescue story

The homepage care inbox preserves original sources and human review decisions. Two Mango/“Stripey” photo updates link to one stable identity. Pippa’s care concern produces a follow-up with an owner and a recorded outcome; a separately verified fictional clinic note records her TNVR procedure by date. Pebble can become a new identity with TNVR unknown. Phone notes follow the same review path. Sample suggestions are prepared annotations, not live AI or automatic photo matching.

The report separates current census totals from dated sightings, distinct cats observed, documented procedures, visits and completed follow-ups. Its CSV includes event IDs, reviewer, clinic reference, original source text and review notes. The pilot planner accepts the team’s own quotes and maintenance assumptions; no vendor costs or volunteer-time savings are invented.

See [the complete walkthrough](docs/BONUS_REVIEW.md) and run `npm run test:rescue-browser` for the full UI → API → SQLite → reload path.

## Hardware and weather tools

This branch includes main commit `c524a90`: DHT11 temperature on D7, five OLED screens, live temperature telemetry, heat/cold/freezing checks, and map/workspace temperature views. The saved rescue exercise also keeps thermal readings, creates linked care follow-ups, and exports their evidence. Humidity is not sampled or reported by that firmware.

The interface follows the supplied `ui-inspo/catssss/` and newer `ui-inspo/` references: warm ivory, teal, coral, Miami cat artwork, and mobile navigation. After the rescue desk, the hardware tools focus on South Point Park and its Arduino. Four sensor cards, including DHT11 ambient temperature, lead to the illustrated edge station, weather outlook, and practical care plan. The compact colony network and population-management mission follow below. See [design and asset notes](docs/UI_DESIGN.md).

**Weather outlook** includes clearly fictional Everyday care, Rain ahead, and Storm prep exercises. **Get NWS outlook** requests the real South Beach area forecast and active alerts through the local server. It needs internet access but no API key; forecasts are cached for ten minutes and carry issue/retrieval timestamps. Missing rain probabilities and an unavailable alert feed remain unknown. The outlook is area-level weather, not a reading or forecast from the Arduino, and does not automatically complete readiness tasks. Live Arduino mode hides the fictional outlook controls.

**Care plan** saves a five-item readiness checklist, lead and backup caregiver, next check-in, handoff notes, and a food packing calculation to the rescue exercise in demo mode, or to the linked physical colony in live mode. Demo plans stay on demo records; real plans require linking a physical station. Portions and packed weight are entered by the caregiver, never inferred from hopper percentage. **Download care brief** produces a text handoff with the current form, source-labeled sensor snapshot, outlook, people, checklist, and supply shortfall. Unsaved form changes are identified in the brief. Nothing is messaged to anyone.

The **colony map** shows saved local records separately from the USB panel. Select a pin or colony entry, filter for care checks, and refresh records. Positions are explicitly schematic rather than GPS locations. **Care for this colony** opens the workspace with that colony selected for caregiver visits. Demo and physical records remain separate.

The community mission pairs the **300,000–400,000** free-roaming-cat range with a **Help manage a colony** action leading to the census. The figure is attributed to **Miami-Dade Animal Services' February 2023 estimate**, and is scoped to Miami-Dade County rather than a current City of Miami census. [County source](https://www.miamidade.gov/global/release.page?Mduid_release=rel1676560952008934).

- Click **Try the sensor story** for a four-step walkthrough: fictional storm outlook and low food → refill/preparation → wet-weather check → care visit and readiness plan.
- The scenario buttons also let you explore a normal day, low reserve, rain, standing water, heat, cold, freezing conditions, or an offline station individually.
- Food reserve, rain around the shelter, water at the station base, and the next suggested caregiver action update together. Temperature alerts prompt checks for possible heat or cold exposure; they do not measure cat body temperature or detect cats.
- **Refill demo hopper** updates only the preview. **Save demo visit** persists the fictional visit in the rescue exercise and dated report, without changing field-workspace visits or real station records.
- Live mode starts unknown until actual USB frames arrive. A live caregiver visit is saved to the existing API only after linking a physical station and entering the visit evidence. It never fabricates a sensor update.
- Cat portraits are illustrations of caregiver records. Census and TNVR records remain in the field workspace, which opens separately so an active USB session can continue.

## Read the Arduino directly in your browser

Open **http://127.0.0.1:3000**. The old `/serial.html` address redirects here; the colony workspace sidebar links back as **Hardware dashboard**.

1. Install SSD1306Ascii, **DHT sensor library by Adafruit**, and **Adafruit Unified Sensor**, then upload [`firmware/colony_monitor/colony_monitor.ino`](firmware/colony_monitor/colony_monitor.ino) to your Uno/classic Nano. The console also has a sketch-download button.
2. Close Arduino Serial Monitor and stop `npm run gateway` so the browser can own the serial port.
3. Use a desktop browser exposing Web Serial on localhost or HTTPS. Click **Connect Arduino** and select the board's USB port.
4. Allow a few seconds for the Uno to restart. The dashboard requests a one-second stream automatically. The main cards show food fill, rain, water, and station temperature in °C/°F; **Inside the little station** expands sonar quality, raw readings, update controls, encoder/button state, and the current OLED page.
5. Expand **Inside the little station** to use Read now, change the update interval, inspect the serial log, or download readings. Demo and live histories remain separate; downloads identify their source, and only live readings can be saved to physical stations.

USB viewing needs neither a station key nor a Node serial gateway. **Inside the little station → Save a live reading to the colony workspace** records one measurement in a provisioned physical station using its device key. Saves are manual and authenticated; duplicates are safe. The key stays in the tab and clears on disconnect. The browser keeps no durable offline queue; use the Node gateway when unattended buffering is needed. Only one of browser/Serial Monitor/gateway may own the board at a time.

The browser page clears current gauges when USB disconnects or measurements become stale. A missing echo stays **Unknown**. Firmware keeps sensing and the rotary encoder still changes screens locally. See [the browser serial guide](docs/BROWSER_SERIAL.md) for protocol, browser requirements, and troubleshooting.

## What works

- **Overview / Colonies:** food estimates, local rain/water signals, connectivity, historic food readings, caregiver visit times, and a focused colony's field updates.
- **Field queue:** low-food, wet-surface, standing-water, heat/cold/freezing risk, unavailable thermometer, bad-sonar, stale-data, and offline checks; assign a caregiver and record completion.
- **Cat census:** stable identities, distinctive markings, dated observations, unknown/needed/confirmed TNVR states, and evidence notes for changes.
- **Phone-friendly field forms:** log visits, link observations to existing cats, create a new identity, and request a care follow-up. Matching a duplicate name is blocked for human review. New identities generate an identity/TNVR review task.
- **Station lifecycle:** planned → bench → deployed → maintenance → retired. Deployment requires recorded permission, a passed bench check, weather protection, and valid calibration. One deployed station per colony.
- **Hardware ingestion:** per-station bearer credentials, schema validation, reboot-safe sequence identity, idempotent replay, and local SQLite persistence.
- **Gateway:** serial reconnection, timestamping, a disk-backed outbox, retry/backoff, and Arduino acknowledgements after the service accepts a packet.
- **Direct USB console:** browser port selection, live sensor cards/history, sample/rate commands, raw frame validation, downloads, and optional manual recording to the workspace.
- **Research and reporting:** a community brief, a cited research document, and a downloadable colony/TNVR/visit summary CSV.
- **Weather preparedness:** optional NWS South Beach outlook, illustrative storm exercises, persistent colony readiness/people/supply plans, and downloadable care handoffs.

No SMS/email is sent, no photos are analyzed, and no chat account is accessed. The provided kit has no dispensing actuator; this system never automatically dispenses food or operates a trap.

## Try the whole story

1. In **Overview**, choose **Try a sensor scenario** → **Food reserve drops to 10%**. The fictional station reading and field queue update.
2. Open **Field queue**, assign the refill task, and save.
3. **Log a visit** with the observed cats, refill action, water action, and field notes. The colony's dated visit and original notes become visible. A visit does not fabricate a sensor reading or change the census total.
4. Simulate **Food reserve refilled to 90%** and inspect the food history. Complete the caregiver task separately.
5. Try **Sonar echo unavailable**: food becomes **Unknown**, rather than 0% or safe.
6. Try **Standing water reaches probe** or **Gateway goes offline** and inspect the distinct follow-up tasks. **Station recovers** restores the fictional station's telemetry.
7. Use **Field update** to link an existing cat, or add a distinctly described new identity. Inspect the resulting census record and identity/TNVR review task. Confirm a TNVR change only with an evidence note.
8. Export the care report from the colony table.

Demo stations emit clearly labeled synthetic refreshes every 30 seconds while the server runs; the offline scenario remains offline until recovered. Scenario controls cannot target a physical station. Sensor tasks are not automatically closed by a good reading: a caregiver records completion. Completed sensor tasks have a 30-minute repeat cooldown; continuing conditions can create another check afterward.

CLI equivalent for a fictional scenario:

```bash
npm run simulate -- CW-001 low-food
npm run simulate -- CW-001 rain
npm run simulate -- CW-001 recover
```

Supported scenarios: `low-food`, `refill`, `rain`, `standing-water`, `no-echo`, `hot`, `cold`, `freezing`, `no-temperature`, `offline`, `recover`.

## Connect the provided hardware

See [the field hardware guide](docs/HARDWARE.md) for mounting, calibration, power, and LED meanings.

| Signal | Uno / classic Nano pin |
| --- | --- |
| Encoder DT / CLK / SW | D2 / D3 / D4 |
| HC-SR04 TRIG / ECHO | D5 / D6 |
| DHT11 temperature DATA / S | **D7** |
| Traffic red / yellow / green | D8 / D9 / D10 |
| RGB red / green / blue | D11 / D12 / D13 |
| Rain DO / AO | A0 / A1 |
| Water-level probe analog signal | **A2**, overriding A0 |
| SSD1306 128×64 SDA / SCL | A4 / A5 |

All components share GND. The Uno has no Wi-Fi: use the direct browser console above, or connect it by USB to a computer/Raspberry Pi running the background Node gateway. The gateway needs a route to the API; in this local version, gateway and server run on the same computer.

For background gateway operation:

1. In **Colonies**, add a new pilot colony with fictional or appropriately controlled field details. In **Stations**, provision a station for it. Keep it in **bench** until checks are actually complete; select **deployed** once the three field checks are recorded.
2. Save the one-time `DEVICE_ID` and `DEVICE_API_KEY`. The service stores only a key hash; the key is not returned by later dashboard reads. If lost, retire/reprovision the station and update the gateway.
3. Copy `.env.example` to `.env`, then set those two values and the serial port. `.env`, SQLite files, and gateway outboxes are ignored by Git.
4. Install **SSD1306Ascii by Bill Greiman**, **DHT sensor library by Adafruit**, and **Adafruit Unified Sensor** in Arduino IDE. Open `firmware/colony_monitor/colony_monitor.ino` and select Uno R3 or classic Nano.
5. Match the firmware calibration constants to that station's dashboard calibration. Upload the firmware. Close Arduino Serial Monitor so the gateway can open the port.
6. Find the device port and start the gateway:

```bash
npm run ports
npm run gateway
```

Typical ports: Linux `/dev/ttyACM0` or `/dev/ttyUSB0`, macOS `/dev/cu.usbmodem…`, Windows `COM3`. Linux serial access may require membership in the operating system's serial-device group.

The **OLED and rotary encoder work without the dashboard**. Rotate three physical detents in either direction to switch among **Food reserve**, **Rain/surface wetness**, **Standing water**, **Station health**, and **Temperature**. Partial travel is shown on the bottom row. Pressing the encoder has no navigation role. The serial port is for telemetry/acknowledgements, not test selection.

## What each measurement means

- **Food:** mount the sonar over a protected, dry-food reserve hopper. Fill is `100 × (empty distance − measured distance) / (empty distance − full distance)`, clamped to 0–100%. The firmware uses a rolling five-reading median, with at least three valid echoes required. This is an approximate fill estimate, not food weight, consumption, freshness, or cat presence.
- **Rain:** AO gives a calibrated surface-wetness index; DO reports the module's wet/dry comparator state with configurable polarity. It cannot establish rainfall rate, a forecast, temperature, or humidity.
- **Water:** install the A2 probe at the station's base to flag local standing water. Its normalized index is not flood depth or drinking-water quality. Moving it into a drinking reservoir changes the intended measurement.
- **Temperature:** a DHT11 module on D7 samples ambient station temperature every two seconds, with °C/°F shown on the website. Heat ≥32°C/89.6°F and freezing ≤0°C/32°F create urgent care checks; cold ≤7°C/44.6°F creates a warning. Missing, failed, or stale readings stay unknown. These are prototype care-check triggers, not feline body-temperature diagnoses. Many DHT11 modules are rated only 0–50°C (±2°C); verify the exact module’s subzero rating before relying on freezing readings. See [wiring, resistor, and range guidance](docs/HARDWARE.md#dht11-thermometer-on-d7).
- **Connectivity:** a deployed station is online after a new accepted packet within two minutes. Measurements older than five minutes are unknown, and offline stations' current gauges also show unknown. Historical data remains available. A stale replay cannot replace a newer sample.

These are prototype inspection thresholds, not animal-welfare or emergency-safety guarantees. The station supplements caregiver visits and official weather information.

## Local storage and configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Local API/dashboard port |
| `DB_PATH` | `./data/colony-watch.sqlite` | Persistent local SQLite file |
| `DEMO_MODE` | `true` | Seed fictional records and run synthetic station refreshes |
| `DEVICE_ID`, `DEVICE_API_KEY` | unset | Gateway's provisioned identity/credential |
| `SERIAL_PORT` | unset in gateway | USB serial device |
| `SERIAL_BAUD` | `115200` | Must match firmware |
| `API_URL` | `http://127.0.0.1:3000` | Gateway destination |
| `GATEWAY_OUTBOX` | `./gateway/outbox.jsonl` | Pending packets; no credential stored |

To start a clean hardware-only workspace, set `DEMO_MODE=false` and choose a **new `DB_PATH`**. Turning demo mode off does not delete existing fictional records. Preserve/back up any existing database before resetting it.

Keep one outbox per station/gateway. Changing a device identity or key while an old outbox remains can block replay; archive the old queue and resolve its original station first. Offline readings older than seven days require operator archival rather than silent removal. Monitor outbox disk growth during long outages. Power and a running gateway are required to record serial frames: the Uno has no SD-card telemetry history.

## Verification

```bash
npm test
npm run test:firmware
npm run test:browser
npm run test:serial-browser
npm run build
```

- `npm test`: API, credential scoping, validation, task/visit/census behavior, live/demo separation, timestamps, SQLite persistence, and outbox retry semantics.
- `test:firmware`: requires `g++`; runs the actual sketch against GPIO/OLED mocks, then forwards its real JSON output through the gateway protocol and authenticated API into SQLite. Confirms median filtering, unknown echoes, rotation, eight-row display layouts, and acknowledgements. It does not replace a physical sensor test.
- `test:browser`: Playwright checks desktop/mobile rendering and complete form → API → stored record → UI flows. It uses installed Chromium or a cached Playwright Chromium; otherwise run `npx playwright install chromium`. Screenshots are written to ignored `test-results/`.
- `test:serial-browser`: tests the USB console against a mocked Web Serial device, including fragmented readings, command replies, failed/canceled connections, authenticated saves, missing echoes, unplug/reconnect, and mobile layout. No physical board is opened by the tests.
- `build`: packages the static AngularJS client into ignored `dist/`. The local server serves `public/` so editing client files does not leave stale build assets in the development workflow. The Node API is still required.

Firmware can also be compiled using Arduino CLI:

```bash
arduino-cli compile --fqbn arduino:avr:uno firmware/colony_monitor
arduino-cli compile --fqbn arduino:avr:nano:cpu=atmega328old firmware/colony_monitor
```

See [verification evidence](docs/VERIFICATION.md). Physical enclosure, hopper accuracy, sensor drift, and actual outdoor deployments remain field-validation work.

## Research and future deployment

- [Community research](docs/COMMUNITY_RESEARCH.md): Miami-Dade TNVR and caregiver workflows, flooding/heat/hurricanes, wildlife tradeoffs, privacy, pilot outcomes, and primary sources.
- [Hardware and operating guide](docs/HARDWARE.md): physical integration and calibration.
- [Architecture and API](docs/ARCHITECTURE.md): telemetry contract, trust boundary, and state transitions.
- [Future Git/Vercel deployment plan](docs/DEPLOYMENT.md): a concrete migration path, not a deployed service.

AngularJS 1.x was explicitly requested and is used here. Its official support ended in January 2022, and `npm audit` reports an unfixed high-severity AngularJS package issue. The app avoids HTML binding, restricts content with CSP, bounds input, and binds locally, but these do not make the legacy framework suitable for public deployment. Plan a supported Angular migration or an explicitly supported AngularJS distribution before exposing the app. [Official AngularJS notice](https://docs.angularjs.org/guide/migration).
