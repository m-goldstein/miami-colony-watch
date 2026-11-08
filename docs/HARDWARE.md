# Hardware installation and edge operation

Use `firmware/colony_monitor/colony_monitor.ino` for monitoring. Keep the original `pins_layout.ino` for component diagnosis. Upload one sketch at a time.

## What is physically connected

The existing Uno/classic Nano pin layout is retained: encoder DT D2, CLK D3, SW D4; HC-SR04 TRIG D5/ECHO D6; traffic R/Y/G D8/D9/D10; RGB R/G/B D11/D12/D13; raindrop DO A0/AO A1; **water signal A2**; OLED SDA A4/SCL A5. D0/D1 remain the USB serial link.

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

Food percentage is approximate geometric fill. It is not kilograms, remaining meals, consumption, food freshness, or evidence that any cat ate. Large changes can reflect refills, removal, a tilted mount, or another object. No temperature-compensation sensor is supplied.

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

1. Food reserve: approximate fill, headspace, valid echoes, refill check.
2. Rain/surface wetness: plate state, raw AO, raw DO, interpretation limits.
3. Standing water: raw A2, normalized index, interpretation limits.
4. Station health: recent browser-reception or saved-upload acknowledgement, packet count, uptime, USB link.

Traffic LEDs show local inspection priority: red for low food or high water index, yellow for unknown sonar/analog data or a wet rain plate, green when those local conditions are clear. A green light does not certify animal welfare, weather safety, food hygiene, or connectivity.

RGB green means a USB host recently acknowledged reception or a saved upload; blue pulses while waiting for a host acknowledgement; red indicates unavailable sonar. Mixed colors can appear. On the OLED, **Browser ACK** indicates local viewing and **Saved ACK** indicates an accepted API upload. Neither guarantees a healthy future connection. Other than startup probing and a bounded retry after display failures, sensing continues even if the OLED fails.

Telemetry defaults to ten seconds at 115200 baud. The browser requests a one-second stream; its rate selector supports other intervals. `STREAM 250..60000` changes the volatile rate, which returns to the default on reboot. Acknowledged uploads cause the host to send `A\n`; direct browser reception uses `B\n`. These acknowledgements do not change the selected screen. See [the serial protocol](BROWSER_SERIAL.md).

## Field deployment sequence

1. Register a colony and station. Verify site permission and suitability; confirm cleanup, access, wildlife considerations, backup caregiver, and a storm plan with the responsible people.
2. Bench-test each sensor with the existing component sketch. Upload the monitoring sketch and verify all four pages without a network connection.
3. Check food geometry and moisture baselines; record matching firmware/dashboard calibration.
4. Use a protected enclosure, strain relief, safe low-voltage power, weather-appropriate cabling, and a sheltered transducer. A standard HC-SR04 and exposed hobby boards are not weatherproof.
5. Provision the station's key, configure its gateway, and verify fresh readings in the dashboard. Close other serial programs. Keep the computer awake while it is the gateway.
6. Mark the station deployed only after completing the actual checks. The checkbox records a human assertion, not an automatic certification.
7. Compare field readings to manual checks during the pilot. Inspect after refills, heavy weather, cleaning, power interruptions, and remounting.

The supplied Uno kit does not include outdoor enclosures, an always-on computer, a modem, solar charging, a battery-health sensor, or a durable board-side event log. Those are physical deployment additions, not features implied by this prototype.
