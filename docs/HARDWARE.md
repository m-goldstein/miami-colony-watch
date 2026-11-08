# Hardware installation and edge operation

Use `firmware/colony_monitor/colony_monitor.ino` for monitoring. Keep the original `pins_layout.ino` for component diagnosis. Upload one sketch at a time.

## What is physically connected

The existing Uno/classic Nano pin layout is retained: encoder DT D2, CLK D3, SW D4; HC-SR04 TRIG D5/ECHO D6; traffic R/Y/G D8/D9/D10; RGB R/G/B D11/D12/D13; raindrop DO A0/AO A1; **water signal A2**; **DHT11 DATA/S D7**; OLED SDA A4/SCL A5. D0/D1 remain the USB serial link.

Follow each module's specified supply voltage. The Uno uses 5V I/O: OLED and sensor logic must accept it or use appropriate level shifting. All grounds must be common. LEDs need current-limiting resistors unless their modules include them. Set `RGB_COMMON_ANODE=1` or `TRAFFIC_ACTIVE_LOW=1` for the corresponding LED hardware. D12/D13 are digital outputs, so the RGB status uses on/off colors; the board's built-in D13 LED may also light.

The Uno itself provides no IP networking. A USB cable connects it either directly to the Web Serial hardware dashboard at `/` (also reachable through `/serial.html`) or to a Node gateway on a laptop, small computer, or Raspberry Pi. Use one serial owner at a time. The local prototype runs gateway and API on the same computer; direct browser viewing needs no gateway process. A future remote installation needs connectivity and power planning.

## Sonar over the food reserve

The intended target is a **reserve container of dry kibble**, with the sensor fixed above the surface and outside the food. An open feeding bowl can be too shallow, too narrow, or obstructed by a cat; those are poor conditions for this method. There is no actuator, automatic feeder, camera, or weight sensor in this kit.

1. Choose a suitable protected container with a broad enough target and room for the transducer's near-field clearance. Keep the ultrasound path unobstructed and avoid reflections from walls or a lip.
2. Record empty distance from the sensor to the empty reference surface. The default is 30cm.
3. Add the planned maximum fill and record full distance. Keep at least the HC-SR04's nominal 2cm minimum distance; the default is 5cm. Dashboard validation requires the two distances to differ by at least 2cm.
4. Record those values in the dashboard station calibration. Copy the matching tenths-of-a-centimeter constants into the firmware: `30.0cm → 300`, `5.0cm → 50`.
5. Compare empty, roughly quarter, half, three-quarter, and full conditions with the caregiver's own fill checks. Repeat after moving the mount. Note uneven kibble surfaces and side reflections.
6. If the geometry cannot produce a repeatable result, keep the food estimate unavailable and change the mount/container or select a different sensor in a future revision. A plausible number is not proof of accuracy.

The firmware triggers at most once per 100ms, allowing a 30ms echo timeout. A rolling five-value window rejects readings outside 2–400cm and reports a median only with at least three valid samples. No echo produces `null`, not 0cm. The service stores raw distance and sample quality. It uses the server-side calibration for dashboard fill; firmware calibration is separately responsible for the OLED and local LEDs.

Food percentage is approximate geometric fill. It is not kilograms, remaining meals, consumption, food freshness, or evidence that any cat ate. Large changes can reflect refills, removal, a tilted mount, or another object. The sonar calculation does not currently apply temperature compensation.

## DHT11 thermometer on D7

Install **DHT sensor library by Adafruit** and its **Adafruit Unified Sensor** dependency in Arduino IDE, alongside SSD1306Ascii. The monitoring sketch selects the `DHT11` sensor type.

Connect module **DATA/S → D7**, **VCC/+ → 5V**, and **GND/− → GND** on the Uno/classic Nano. Follow the module's labels: three-pin breakout pin orders vary. For a bare four-pin DHT11, use its datasheet pinout and leave NC unconnected.

A pull-up goes **between DATA and VCC**, never in series with DATA. If your existing resistor is **4.7 kΩ**, it can stay: the [Aosong DHT11 revision 1.3 datasheet](https://akizukidenshi.com/goodsaffix/DHT11_20180119.pdf) specifies that value. **10 kΩ** is also used in [Adafruit's DHT wiring guide](https://learn.adafruit.com/dht/connecting-to-a-dhtxx-sensor). A module with an onboard DATA-to-VCC pull-up needs no additional external resistor; inspect its board or schematic. A 220Ω/330Ω LED resistor is unsuitable as the data pull-up.

The sketch waits two seconds after initialization and samples at most once per two seconds, regardless of the USB stream interval. The library checks sensor timing/checksums. A failed read clears the previous value and emits `temperatureC: null`; a later successful read recovers automatically. A DHT transaction briefly occupies the CPU and disables interrupts while reading its pulse train; verify encoder response on the physical board.

Mount the sensor in shaded, ventilated air near the shelter, away from direct sun, hot electronics, wet surfaces, and cat contact. It measures the local surroundings, not feline body temperature, forecast temperature, or heat index. Humidity is not currently reported by this interface.

| Ambient reading | Care alert / local traffic LED |
| --- | --- |
| ≥32°C / 89.6°F | Urgent heat check: shade, fresh drinking water, cooler shelter; red |
| >0°C and ≤7°C / 44.6°F | Cold warning: inspect cats, dry insulated shelter and water; yellow |
| ≤0°C / 32°F | Urgent freezing check: warm dry shelter and unfrozen drinking water; red |
| Failed or unavailable | Unknown; inspect thermometer and assess the site in person; yellow |

Thresholds are prototype inspection defaults in `public/temperature.js` and matching firmware constants. They are not universal safe/unsafe boundaries. Wind, humidity, exposure time, age, and health affect risk. Care suggestions follow [Cats Protection's warm-weather guidance](https://www.cats.org.uk/help-and-advice/caring-for-your-cat/home-and-environment/seasonal-advice/cats-and-warm-weather) and [RSPCA's cold-weather guidance](https://www.rspca.org.uk/adviceandwelfare/seasonal/winter/pets/cats); the 32°C heat trigger is a project choice, not a veterinary diagnostic threshold. Contact a veterinarian promptly for a cat showing distress.

**Freezing limitation:** [Adafruit lists common DHT11s as 0–50°C with ±2°C accuracy](https://learn.adafruit.com/dht/overview), while Aosong's newer revision 1.3 specifies −20–60°C. The firmware/API accept −20–60°C to support that revision, but cannot identify your module's revision automatically. Confirm your actual module's rated range; a 0–50°C unit cannot provide reliable subzero monitoring. Keep the early cold warning active and use a verified subzero-rated sensor when freezing detection matters. No alert is a guarantee of animal safety.

Bench-check an ambient reading against a reference thermometer, exercise the cold/heat/freezing software demo scenarios, then disconnect/reconnect DATA or power to confirm unknown/recovery behavior. Do not freeze or overheat an out-of-range sensor just to exercise the alert.

## Rain plate and standing-water probe

Place the rain plate where local exposure is representative, away from food and with its comparator electronics protected. Connect AO A1 and DO A0. DO uses a pull-up and defaults to LOW = wet; confirm against the actual module. A disconnected DO can read HIGH, so test a real dry-to-wet transition.

The A2 water probe is intended to detect **local standing water at the station's base**. Fix its sensing area at a chosen height without exposing its control electronics. It measures wetness/contact at that placement, not a regional flood level. Do not label this probe as a drinking-water measurement unless its placement and interpretation are deliberately redesigned.

For both probes:

- Measure dry and wet raw ADC baselines using the actual modules and expected site water.
- Record the baselines in dashboard calibration and matching firmware constants. Analog direction may be reversed; normalization supports either polarity.
- Keep wet/dry endpoints at least 50 counts apart for the dashboard's basic calibration check.
- Adjust the rain module's potentiometer to exercise DO. Its comparator threshold is independent of the analog normalization.
- Validate repeatability with splash, dirt, and drying cycles. Clean and inspect exposed traces for corrosion. Continuous exposure can shorten the life of inexpensive resistive probes.

The wetness index is 0–100 relative to those endpoints. It is not relative humidity, rainfall rate, flood depth, salinity, or water quality. A dry plate cannot rule out flooding elsewhere. Official warnings and human access decisions take priority.

## Local screens and LEDs

Rotate **three detents** to change pages, in either direction. Set `ENCODER_DETENTS_PER_SCREEN` for a different travel distance. `ENCODER_STEPS_PER_DETENT` configures the encoder's quadrature hardware separately. `ENCODER_REVERSED` changes the direction. Encoder SW has no navigation action.

Firmware 1.3 checks the OLED text every 250 ms and writes only changed characters in place. It pads shorter values to remove old digits and disables scrolling. The screen is cleared during display initialization, rather than on every refresh, to avoid a rolling redraw.

1. Food reserve: approximate fill, headspace, valid echoes, refill check.
2. Rain/surface wetness: plate state, raw AO, raw DO, interpretation limits.
3. Standing water: raw A2, normalized index, interpretation limits.
4. Station health: recent browser-reception or saved-upload acknowledgement, packet count, uptime, USB link.
5. Temperature: DHT11 ambient reading, heat/cold/freezing check, unknown state, and frost-rating reminder.

Traffic LEDs show local inspection priority: red for low food, high water index, heat or freezing; yellow for cold, unavailable temperature/sonar/analog data, or a wet rain plate, green when those local conditions are clear. A green light does not certify animal welfare, weather safety, food hygiene, or connectivity.

RGB green means a USB host recently acknowledged reception or a saved upload; blue pulses while waiting for a host acknowledgement; red indicates unavailable sonar. Mixed colors can appear. On the OLED, **Browser ACK** indicates local viewing and **Saved ACK** indicates an accepted API upload. Neither guarantees a healthy future connection. Other than startup probing and a bounded retry after display failures, sensing continues even if the OLED fails.

Telemetry defaults to ten seconds at 115200 baud. The browser requests a one-second stream; its rate selector supports other intervals. `STREAM 250..60000` changes the volatile rate, which returns to the default on reboot. Acknowledged uploads cause the host to send `A\n`; direct browser reception uses `B\n`. These acknowledgements do not change the selected screen. See [the serial protocol](BROWSER_SERIAL.md).

## Field deployment sequence

1. Register a colony and station. Verify site permission and suitability; confirm cleanup, access, wildlife considerations, backup caregiver, and a storm plan with the responsible people.
2. Bench-test each sensor with the existing component sketch. Upload the monitoring sketch and verify all five pages without a network connection.
3. Check food geometry and moisture baselines; record matching firmware/dashboard calibration.
4. Use a protected enclosure, strain relief, safe low-voltage power, weather-appropriate cabling, and a sheltered transducer. A standard HC-SR04 and exposed hobby boards are not weatherproof.
5. Provision the station's key, configure its gateway, and verify fresh readings in the dashboard. Close other serial programs. Keep the computer awake while it is the gateway.
6. Mark the station deployed only after completing the actual checks. The checkbox records a human assertion, not an automatic certification.
7. Compare field readings to manual checks during the pilot. Inspect after refills, heavy weather, cleaning, power interruptions, and remounting.

The supplied Uno kit does not include outdoor enclosures, an always-on computer, a modem, solar charging, a battery-health sensor, or a durable board-side event log. Those are physical deployment additions, not features implied by this prototype.
