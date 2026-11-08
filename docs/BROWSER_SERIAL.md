# Direct Arduino-to-browser serial console

The live hardware dashboard is **http://127.0.0.1:3000** after `npm start`. The cat-centered front page defaults to a labeled fictional demo with animated reserve, rain, water, and care-action illustrations. Choose **Live Arduino** for actual serial readings; technical controls sit in **Inside the little station**. The old `/serial.html` address redirects to this homepage. The existing colony-management workspace is at `/colonies.html`, linked from the header, and its sidebar links back as **Hardware dashboard**. The device page uses native Web Serial and plain browser modules; it does not load AngularJS or require the Node serial gateway for viewing.

## Preview and live modes

**Demo colony** is an isolated presentation sandbox. The four-step walkthrough and scenario buttons update a fictional scene and preview history without touching a USB port, physical-device records, or ingestion API. Preview visits remain in tab memory. The source badge explicitly identifies fictional data. Demo downloads are labeled `demo-preview`.

**Live Arduino** uses only validated frames from the real serial stream. Selecting it starts with unknown gauges until hardware data arrives. Connecting the board selects live mode. Switching to the demo can leave an existing USB stream running in the background, but simulated readings never enter the live history or save path. Switching to demo clears the device-key input; saving is disabled outside live mode.

The hero's 300,000–400,000 population range is attributed to a February 2023 Miami-Dade County estimate, with a source link and date. Its action leads to the existing census/TNVR workspace. It is not shown as a fresh measured population.

## Setup

1. Keep the original wiring: HC-SR04 TRIG D5/ECHO D6; encoder DT D2/CLK D3/SW D4; rain DO A0/AO A1; water signal **A2**; DHT11 DATA/S D7 (VCC 5V, common GND); OLED SDA A4/SCL A5; existing LEDs D8–D13.
2. Install **SSD1306Ascii by Bill Greiman**, **DHT sensor library by Adafruit**, and **Adafruit Unified Sensor**. See [DHT11 resistor and range guidance](HARDWARE.md#dht11-thermometer-on-d7). Upload `firmware/colony_monitor/colony_monitor.ino` (firmware `colony-monitor/1.2`) using Arduino IDE. Match the firmware's food/moisture calibration constants to the physical setup. The page's **Download Arduino sketch** link serves this exact file.
3. Close Arduino Serial Monitor and stop any Node gateway using that port. Choose **Live Arduino** on the dashboard, or connect directly with the Connect Arduino button.
4. Open the console in a browser exposing `navigator.serial`, such as desktop Chrome or Edge. The page feature-detects support and disables connection with an explanation when unavailable. Use localhost or HTTPS; the API requires a secure context and a user gesture for port selection. [Chrome's Web Serial guide](https://developer.chrome.com/docs/capabilities/serial), [Web Serial standard](https://serial.spec.whatwg.org/).
5. Click **Connect Arduino**, select its port, and wait a few seconds for startup. Many Uno boards restart when USB serial is opened. The console configures the stream on the boot event, with a delayed fallback handshake for boards already running.

The console opens **115200 baud, 8 data bits, no parity, 1 stop bit, no flow control**. It does not silently reuse a previously permitted port or open hardware on page load.

## UI behavior

- **Connect / Disconnect:** explicit port selection and stream-lock cleanup; reconnect after a cable removal by choosing the port again.
- **Update interval:** requests 0.5, 1, 2, 5, or 10 seconds; the UI separately shows the interval confirmed by the firmware. The default requested browser rate is one second.
- **Read now:** requests the latest filtered measurement. It does not move the OLED page or operate a feeder.
- **Temperature:** DHT11 ambient °C/°F; heat ≥32°C, cold ≤7°C, freezing ≤0°C, and missing-sensor guidance. These prompt caregiver checks, not diagnoses. Readings sample every two seconds; faster USB intervals repeat the last result. Verify the module’s subzero rating before relying on freezing detection.
- **Live cards:** calibrated board food estimate; raw sonar distance and valid echo count; rain wet/dry plus raw AO/DO; water wetness index plus raw A2; encoder position, button state, and current OLED page; packet count and uptime.
- **History:** up to 120 readings in tab memory. Unknown echoes leave gaps in the sonar graph. Missing echoes are not drawn as zero.
- **Serial activity:** bounded recent log of frames, replies, and errors. Data is rendered as text. Malformed or overlong lines are rejected, and parsing resumes at the next newline.
- **Download readings:** exports the retained measurements as JSON Lines, including their browser receipt times and session IDs.

In live mode, no sensor values are fabricated before a board sends a valid frame. The separate, labeled demo uses fictional preview values. Current gauges clear on disconnection or when the latest reading is older than the greater of five seconds or three confirmed stream intervals. History remains available as history. A paused/backgrounded tab may be unable to maintain active processing; this interface is an attended bench/field console rather than an unattended data logger.

The browser keeps the latest acquisition time, not a save-click time. A firmware reboot/sequence rollback starts a new session. Repeated frames with the same sequence are ignored locally. A manual save replay uses the same `(deviceId, bootId, sequence)` identity so the API can deduplicate it.

## Optional recording in Colony Watch

Live USB viewing does not need a device key. To persist a reading:

1. In the dashboard, create a colony and provision a **physical** station; record its calibration and actual field checks. The new device key is shown once.
2. Expand **Inside the little station**, then **Save a live reading to the colony workspace**. This action is enabled only for fresh live USB measurements.
3. Click **Load stations**, select the physical station, and paste its key. Fictional demo stations and retired devices are excluded.
4. Click **Save latest reading**. One current validated packet is sent to `/api/readings` with the station bearer key. The API applies its normal validation, provenance, task rules, and idempotency. A successful response is reported separately from USB connection state.

The key is held only in this tab, never written to browser storage, and cleared on disconnect or page exit. It is never transmitted to the Arduino or included in logs/downloads. The API stores its normal hash rather than returning the key on later workspace reads.

Saves are manual. There is no IndexedDB queue, background upload loop, or durable browser outbox. Closing the tab discards its unsaved readings. For persistent unattended recording and offline replay, use `npm run gateway` instead, after disconnecting the browser. The provided Uno has no board-side durable measurement log.

## Firmware protocol

Commands are bounded ASCII lines terminated by `\n`; `\r\n` is also accepted. The firmware command buffer is 24 bytes including its terminator. An oversized command is discarded through its next newline and returns one error; subsequent commands still work.

| Host → Arduino | Result |
| --- | --- |
| `HELLO` | Firmware/version/protocol/interval response |
| `STREAM 1000` | Change packet interval to 1000ms; accepted range 250–60000ms |
| `SAMPLE` | Emit the latest filtered sensor reading once analog sampling is available |
| `B` | Acknowledge local browser reception; no persistence implied |
| `A` | Acknowledge a successful API save, compatible with the Node gateway |

Firmware responses are newline-delimited JSON:

```json
{"event":"boot","firmware":"colony-monitor/1.2"}
{"event":"hello","firmware":"colony-monitor/1.2","protocolVersion":1,"telemetryIntervalMs":10000,"screenCount":5}
{"event":"stream","intervalMs":1000}
{"event":"error","message":"STREAM needs 250..60000 milliseconds"}
```

A measurement extends the existing schema-1 frame, so the Node gateway and API remain compatible:

```json
{"schemaVersion":1,"sequence":42,"uptimeMs":430000,"sonarDistanceCm":20.0,"sonarValidSamples":5,"rainAnalog":900,"rainDigital":1,"waterAnalog":100,"temperatureC":26.0,"foodPercent":40,"rainWet":false,"waterIndex":0,"encoderPosition":3,"buttonPressed":false,"screen":1}
```

`screen` is 0–4: food, rain, water, health, temperature. Older four-screen firmware is also accepted; its absent temperature is unknown. The three-detent rotary threshold remains the only way to navigate physical OLED screens. Host commands only control transport/requests and acknowledgements.

When fewer than three of the rolling five echoes are valid, both `sonarDistanceCm` and `foodPercent` are `null`. The browser validates ADC, quality, sequence, optional derived fields, and booleans before displaying them. The server envelope omits UI-only fields and applies station calibration to raw measurements as before.

The browser sends `B` after a valid measurement is displayed, and `A` only after the workspace accepts a manual save. OLED station health distinguishes **Browser ACK** from **Saved ACK**. Green RGB means recent host acknowledgement, not necessarily database persistence. Red RGB still indicates unavailable sonar; blue pulses while no host acknowledgement is recent.

The stream rate is volatile and returns to ten seconds on board reboot. Disconnecting a browser does not change the sensing pipeline or write EEPROM. Sonar still samples at 100ms intervals and the analog channels at 500ms intervals; asking for a 250ms stream can repeat the most recent analog sample.

## Troubleshooting

- **No Web Serial support:** use a browser exposing `navigator.serial` on localhost/HTTPS. The interface reports the actual capability rather than assuming every browser supports it.
- **Port busy / access denied:** close Serial Monitor, another browser tab, or the background Node gateway. Verify OS serial permissions and a data-capable cable.
- **Connected but waiting:** allow the bootloader/startup delay, click Read now, and confirm this monitoring sketch is uploaded at 115200 baud. The original component-test sketch emits a different format.
- **Stream interval never confirmed:** upload firmware 1.1. Older monitoring firmware may emit basic readings but does not implement the browser command replies or all derived values.
- **Food unknown / no echo:** check sensor power, D5/D6 wiring, hopper geometry, target clearance, and valid echo count. Unknown is an inspection state, not an empty-food measurement.
- **UI and dashboard estimates differ:** match the board's calibration constants and the provisioned station's dashboard calibration. Both retain the raw distance; their configuration is intentionally explicit, not remotely synchronized.
- **Save fails:** check the selected device/key and API availability. USB viewing continues. Unsaved browser readings are not queued for automatic retry.

## Caregiver visits

**Log a care visit** opens a short form with caregiver, observed cats, food/water actions, and notes. In demo mode the visit is explicitly a preview note and is not sent to the API. In live mode, first select a physical station in the workspace tools; its colony receives the human-entered visit through `/api/visits`. A visit does not change the food or weather readings.

Care suggestions describe the sensor condition and the next inspection step. They are not a new server task queue or a diagnosis. The existing field queue and census open in a separate workspace tab.

## Tests

`npm test` includes protocol, stream fragmentation/UTF-8, bounded-line recovery, malformed frames, connection cleanup, chooser cancellation, busy-port errors, and reconnect tests. `npm run test:firmware` checks the actual C++ command parser and validates emitted frames against the browser parser. `npm run test:serial-browser` uses a mocked Web Serial port and real local API to verify live cards, command replies, optional persistence, no-echo behavior, download, disconnect/reconnect, and mobile layout.

These are software checks. They do not grant a site permission to a real USB port, flash the board, or replace a physical cable/sensor test.
