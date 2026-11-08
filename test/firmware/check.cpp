#include <cassert>
#include <iostream>
#include "../../firmware/colony_monitor/colony_monitor.ino"
void advance(unsigned long elapsed) { simulatedNow += elapsed; loop(); }
void temperatureSample(float value) {
  simulatedTemperatureC = value; advance(TEMPERATURE_INTERVAL_MS);
}
void state(uint8_t s) { pinValues[ENCODER_CLK] = (s >> 1) & 1; pinValues[ENCODER_DT] = s & 1; encoderChanged(); }
void turn(int clicks) {
  for (int i = 0; i < (clicks < 0 ? -clicks : clicks); ++i) {
    if (clicks > 0) { state(1); state(0); state(2); state(3); }
    else { state(2); state(0); state(1); state(3); }
    loop();
  }
}
void checkDisplay() {
#if ENABLE_OLED
  advance(250);
  unsigned rows = 1, width = 0;
  for (char c : display.text()) {
    if (c == '\n') { assert(width <= 21); width = 0; ++rows; }
    else ++width;
  }
  assert(rows == 8 && width <= 21);
#endif
}
int main() {
  analogValues[A2] = 100; analogValues[A1] = 900;
  setup();
  assert(!haveTemperature && thermometer.started && temperatureReads == 0);
  assert(pinModes[A2] == INPUT && pinModes[A1] == INPUT && pinModes[A0] == INPUT_PULLUP);
  assert(screen == 0 && !foodKnown());
  simulatedEchoUs = 1160;
  advance(100); assert(!foodKnown() && validSamples == 1);
  advance(100); advance(100);
  assert(foodKnown() && distanceTenthsCm == 200 && foodPercent() == 40);
  simulatedEchoUs = 23200; advance(100);
  simulatedEchoUs = 1160; advance(100); assert(distanceTenthsCm == 200);
  assert(haveAnalog && waterRaw == 100 && rainRaw == 900 && !rainWet());
  advance(1499); assert(!haveTemperature && temperatureReads == 0);
  advance(1); assert(haveTemperature && temperatureTenthsC == 260 && temperatureReads == 1);
  advance(1999); assert(temperatureReads == 1); // USB refreshes cannot over-poll the DHT11.
  advance(1); assert(temperatureReads == 2);
  assert(normalized(100, 100, 800) == 0 && normalized(800, 100, 800) == 100);
  assert(normalized(900, 900, 250) == 0 && normalized(250, 900, 250) == 100);
  turn(2); assert(screen == 0 && screenTravel == 2);
  turn(1); assert(screen == 1 && screenTravel == 0);
  checkDisplay();
#if ENABLE_OLED
  assert(display.scrollMode == SCROLL_MODE_OFF && display.clears == 1);
  const unsigned stableWrites = display.writes;
  advance(250);
  assert(display.writes == stableWrites); // An unchanged frame performs no OLED writes.
  const std::string stableHeading = display.rows[0];
  analogValues[A1] = 9; advance(500);
  assert(display.rows[3] == "AO A1: 9             "); // Erase old digits without blanking the row.
  assert(display.rows[0] == stableHeading && display.clears == 1);
  assert(display.writes - stableWrites == 2); // Only the two stale digits change.
  analogValues[A1] = 900; advance(500);
#endif
  turn(-3); assert(screen == 0);
  turn(-3); assert(screen == 4); checkDisplay();
  turn(-3); assert(screen == 3); checkDisplay();
  turn(-3); assert(screen == 2); checkDisplay();
  pinValues[ENCODER_SW] = LOW; advance(1000); assert(screen == 2);
  pinValues[ENCODER_SW] = HIGH;
  Serial.input = "A\n"; loop(); assert(uplinkRecent(simulatedNow));
  advance(45000); assert(!uplinkRecent(simulatedNow));
  Serial.input = "B\n"; loop(); assert(browserRecent(simulatedNow));
  assert(!uplinkRecent(simulatedNow));  // Browser reception is not a saved upload.
  Serial.output.clear(); Serial.input = "HELLO\r\n"; loop();
  assert(Serial.output.find("colony-monitor/1.3") != std::string::npos);
  assert(Serial.output.find("\"screenCount\":5") != std::string::npos);
  Serial.input = "STREAM 500\n"; loop(); assert(telemetryIntervalMs == 500);
  Serial.input = "STREAM 1\nSTREAM 999999999999999\nSTREAM -500\n"; loop();
  assert(telemetryIntervalMs == 500);
  Serial.output.clear(); Serial.input = "SAMPLE\n"; loop();
  assert(Serial.output.find("\"schemaVersion\":1") != std::string::npos);
  Serial.output.clear(); Serial.input = "STREAM 250000000000000000000000000000000\nHELLO\n"; loop();
  assert(Serial.output.find("Command too long") != std::string::npos);
  assert(Serial.output.find("\"event\":\"hello\"") != std::string::npos);
  Serial.input = "STREAM 10000\n"; loop(); assert(telemetryIntervalMs == TELEMETRY_INTERVAL_MS);
  const uint8_t priorScreen = screen;
  Serial.input = "SCREEN 0\n"; loop(); assert(screen == priorScreen); // Rotation owns OLED navigation.
  temperatureSample(32.0f); assert(haveTemperature && temperatureTenthsC == 320);
  assert(pinValues[TRAFFIC_R] == (TRAFFIC_ACTIVE_LOW ? LOW : HIGH));
  temperatureSample(7.0f); assert(temperatureTenthsC == 70);
  assert(pinValues[TRAFFIC_Y] == (TRAFFIC_ACTIVE_LOW ? LOW : HIGH));
  temperatureSample(0.0f); assert(haveTemperature && temperatureTenthsC == 0);
  assert(pinValues[TRAFFIC_R] == (TRAFFIC_ACTIVE_LOW ? LOW : HIGH));
  for (float invalid : {NAN, 85.0f, 61.0f, -21.0f}) {
    temperatureSample(invalid); assert(!haveTemperature);
    assert(pinValues[TRAFFIC_Y] == (TRAFFIC_ACTIVE_LOW ? LOW : HIGH));
  }
  temperatureSample(26.0f); assert(haveTemperature); // Reconnect recovers automatically.
#if ENABLE_OLED
  assert(display.clears == 1); // Sensor updates and page changes never clear the screen.
  Wire.timedOut = true; advance(250); assert(!displayReady);
  advance(60000); assert(displayReady && display.clears == 2);
  advance(250); assert(display.rows[0] == "COLONY WATCH 3/5     "); // Redraw after I2C recovery.
#endif
  // Emit actual firmware JSON lines for the Node ingestion integration test.
  Serial.output.clear();
  simulatedEchoUs = 1160;
  for (int i = 0; i < 5; ++i) advance(100);
  lastTelemetry = simulatedNow - TELEMETRY_INTERVAL_MS;
  loop();
  std::cout << Serial.output;
  Serial.output.clear();
  simulatedEchoUs = 0;
  temperatureSample(NAN);
  for (int i = 0; i < 5; ++i) advance(100);
  assert(!foodKnown() && validSamples == 0);
  lastTelemetry = simulatedNow - TELEMETRY_INTERVAL_MS;
  loop();
  std::cout << Serial.output;
  assert(pinValues[TRAFFIC_Y] == (TRAFFIC_ACTIVE_LOW ? LOW : HIGH));
  for (float value : {36.0f, 5.0f, -2.0f}) {
    temperatureSample(value);
    Serial.output.clear(); sampleRequested = true; loop();
    std::cout << Serial.output;
  }
}
