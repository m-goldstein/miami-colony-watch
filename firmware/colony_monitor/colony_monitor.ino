// Colony Watch edge station — Arduino Uno R3 / classic Nano ATmega328P.
// Existing test sketch remains separate in pins_layout/. This is monitoring firmware.
#ifndef ENABLE_OLED
#define ENABLE_OLED 1
#endif
#ifndef ENCODER_STEPS_PER_DETENT
#define ENCODER_STEPS_PER_DETENT 4
#endif
#ifndef ENCODER_DETENTS_PER_SCREEN
#define ENCODER_DETENTS_PER_SCREEN 3
#endif
#ifndef ENCODER_REVERSED
#define ENCODER_REVERSED 0
#endif
#ifndef RGB_COMMON_ANODE
#define RGB_COMMON_ANODE 0
#endif
#ifndef TRAFFIC_ACTIVE_LOW
#define TRAFFIC_ACTIVE_LOW 0
#endif
#include <Arduino.h>
#include <string.h>
#include <math.h>
#include <DHT.h>
#if ENABLE_OLED
#include <Wire.h>
#include <SSD1306Ascii.h>
#include <SSD1306AsciiWire.h>
SSD1306AsciiWire display;
bool displayReady = false;
unsigned long lastDisplayAttempt = 0;
#endif

// Copy each station's dashboard calibration here before uploading.
// Sonar measures headspace above a dry-food hopper, not an open feeding bowl.
const uint16_t FOOD_FULL_TENTHS_CM = 50;   // 5.0cm; keep >= HC-SR04 minimum 2cm.
const uint16_t FOOD_EMPTY_TENTHS_CM = 300; // 30.0cm.
const uint16_t WATER_DRY_RAW = 100;
const uint16_t WATER_WET_RAW = 800;
const uint16_t RAIN_DRY_RAW = 900;
const uint16_t RAIN_WET_RAW = 250;
const bool RAIN_ACTIVE_LOW = true;
const uint8_t FOOD_LOW_PERCENT = 25;
const uint8_t WATER_ALERT_PERCENT = 60;
// Ambient care-check triggers, not cat body temperatures. Match public/temperature.js.
const int16_t TEMPERATURE_COLD_TENTHS_C = 70;
const int16_t TEMPERATURE_FREEZING_TENTHS_C = 0;
const int16_t TEMPERATURE_HOT_TENTHS_C = 320;

const uint8_t THERM_PIN = 7; // DHT11 DATA/S; module VCC to 5V and GND to GND.
// A bare sensor needs a DATA-to-VCC pull-up (4.7k is suitable).
// Breakout modules commonly include it already; check the module markings.
DHT thermometer(THERM_PIN, DHT11);
const uint8_t ENCODER_DT = 2, ENCODER_CLK = 3, ENCODER_SW = 4;
const uint8_t SONAR_TRIG = 5, SONAR_ECHO = 6;
const uint8_t TRAFFIC_R = 8, TRAFFIC_Y = 9, TRAFFIC_G = 10;
const uint8_t RGB_R = 11, RGB_G = 12, RGB_B = 13;
// User's wiring: A0 is rain DO, A1 is rain AO, water signal is overridden to A2.
const uint8_t RAIN_DO = A0, RAIN_AO = A1, WATER_SIGNAL = A2;
const unsigned long SONAR_INTERVAL_MS = 100, ANALOG_INTERVAL_MS = 500;
const unsigned long TELEMETRY_INTERVAL_MS = 10000, DISPLAY_INTERVAL_MS = 250;
const uint8_t SCREEN_COUNT = 5;
const unsigned long TEMPERATURE_INTERVAL_MS = 2000;
unsigned long lastTemperature = 0;
bool haveTemperature = false;
int16_t temperatureTenthsC = 0;
volatile long encoderPosition = 0;
volatile uint8_t previousState = 0;
volatile int8_t encoderTransitions = 0;
long reportedPosition = 0, screenTravel = 0;
uint8_t screen = 0, sampleIndex = 0, validSamples = 0;
uint16_t echoes[5] = {0, 0, 0, 0, 0};
uint16_t distanceTenthsCm = 0, waterRaw = 0, rainRaw = 0;
uint8_t rainDigital = HIGH;
unsigned long lastSonar = 0, lastAnalog = 0, lastTelemetry = 0, lastDisplay = 0;
unsigned long lastAck = 0, sequence = 0;
unsigned long lastBrowserAck = 0, telemetryIntervalMs = TELEMETRY_INTERVAL_MS;
bool haveAck = false, haveBrowserAck = false, haveAnalog = false, sampleRequested = false;
char serialCommand[24];
uint8_t serialCommandLength = 0;
bool serialCommandOverflow = false;
static_assert(ENCODER_STEPS_PER_DETENT == 1 || ENCODER_STEPS_PER_DETENT == 2 || ENCODER_STEPS_PER_DETENT == 4, "Quadrature steps must be 1, 2, or 4");
static_assert(ENCODER_DETENTS_PER_SCREEN >= 1 && ENCODER_DETENTS_PER_SCREEN <= 99, "Use 1..99 detents per screen");
static_assert(FOOD_EMPTY_TENTHS_CM > FOOD_FULL_TENTHS_CM && FOOD_FULL_TENTHS_CM >= 20, "Invalid food calibration");
static_assert(WATER_DRY_RAW != WATER_WET_RAW && RAIN_DRY_RAW != RAIN_WET_RAW, "Wet and dry calibration must differ");

void encoderChanged() {
  const int8_t transitions[] = {0,-1,1,0,1,0,0,-1,-1,0,0,1,0,1,-1,0};
  const uint8_t state = (digitalRead(ENCODER_CLK) << 1) | digitalRead(ENCODER_DT);
  const uint8_t previous = previousState;
  previousState = state;
  if ((previous ^ state) == 3) { encoderTransitions = 0; return; }
  encoderTransitions += transitions[(previous << 2) | state];
  if (encoderTransitions >= ENCODER_STEPS_PER_DETENT) {
    encoderPosition += ENCODER_REVERSED ? -1 : 1; encoderTransitions = 0;
  } else if (encoderTransitions <= -ENCODER_STEPS_PER_DETENT) {
    encoderPosition += ENCODER_REVERSED ? 1 : -1; encoderTransitions = 0;
  }
}
void serviceEncoder() {
  noInterrupts(); const long position = encoderPosition; interrupts();
  if (position == reportedPosition) return;
  const long movement = screenTravel + position - reportedPosition;
  const long moved = movement / ENCODER_DETENTS_PER_SCREEN;
  screenTravel = movement % ENCODER_DETENTS_PER_SCREEN;
  screen = (screen + moved % SCREEN_COUNT + SCREEN_COUNT) % SCREEN_COUNT;
  reportedPosition = position;
  lastDisplay = millis() - DISPLAY_INTERVAL_MS;
}
int normalized(uint16_t raw, uint16_t dry, uint16_t wet) {
  const long value = (static_cast<long>(raw) - dry) * 100L / (static_cast<long>(wet) - dry);
  return value < 0 ? 0 : (value > 100 ? 100 : value);
}
bool foodKnown() { return validSamples >= 3; }
int foodPercent() { return normalized(distanceTenthsCm, FOOD_EMPTY_TENTHS_CM, FOOD_FULL_TENTHS_CM); }
bool rainWet() { return rainDigital == (RAIN_ACTIVE_LOW ? LOW : HIGH); }
bool uplinkRecent(unsigned long now) { return haveAck && now - lastAck < 45000; }
bool browserRecent(unsigned long now) { return haveBrowserAck && now - lastBrowserAck < 45000; }
void serviceSonar(unsigned long now) {
  if (now - lastSonar < SONAR_INTERVAL_MS) return;
  lastSonar = now;
  digitalWrite(SONAR_TRIG, LOW); delayMicroseconds(2);
  digitalWrite(SONAR_TRIG, HIGH); delayMicroseconds(10); digitalWrite(SONAR_TRIG, LOW);
  const unsigned long echo = pulseIn(SONAR_ECHO, HIGH, 30000);
  echoes[sampleIndex] = echo >= 116 && echo <= 23200 ? static_cast<uint16_t>(echo) : 0;
  sampleIndex = (sampleIndex + 1) % 5;
  uint16_t sorted[5]; validSamples = 0;
  for (uint8_t i = 0; i < 5; ++i) if (echoes[i]) sorted[validSamples++] = echoes[i];
  for (uint8_t i = 1; i < validSamples; ++i) {
    const uint16_t value = sorted[i]; int8_t j = i - 1;
    while (j >= 0 && sorted[j] > value) { sorted[j + 1] = sorted[j]; --j; }
    sorted[j + 1] = value;
  }
  distanceTenthsCm = foodKnown() ? (sorted[validSamples / 2] * 10UL + 29UL) / 58UL : 0;
}
void serviceAnalog(unsigned long now) {
  if (now - lastAnalog < ANALOG_INTERVAL_MS) return;
  lastAnalog = now;
  rainRaw = analogRead(RAIN_AO); rainDigital = digitalRead(RAIN_DO);
  waterRaw = analogRead(WATER_SIGNAL); haveAnalog = true;
}
void serviceTemperature(unsigned long now) {
  // Allow startup settling; never poll faster than once every two seconds.
  if (now - lastTemperature < TEMPERATURE_INTERVAL_MS) return;
  lastTemperature = now;
  const float value = thermometer.readTemperature();
  // DHT library returns NaN on timeout/checksum failure. Failed reads clear
  // the previous value. Newer DHT11 revisions specify -20..60C; older modules
  // may only support 0..50C. Verify the actual module before relying on frost readings.
  haveTemperature = isfinite(value) && value >= -20.0f && value <= 60.0f;
  if (haveTemperature) temperatureTenthsC = static_cast<int16_t>(lroundf(value * 10.0f));
}
void tenths(Print& output, uint16_t value) { output.print(value / 10); output.print('.'); output.print(value % 10); }
void printTemperature(Print& output) {
  if (temperatureTenthsC < 0) output.print('-');
  tenths(output, temperatureTenthsC < 0 ? -temperatureTenthsC : temperatureTenthsC);
}
void serviceTelemetry(unsigned long now) {
  if (!haveAnalog || (!sampleRequested && now - lastTelemetry < telemetryIntervalMs)) return;
  sampleRequested = false;
  lastTelemetry = now;
  Serial.print(F("{\"schemaVersion\":1,\"sequence\":")); Serial.print(sequence++);
  Serial.print(F(",\"uptimeMs\":")); Serial.print(now);
  Serial.print(F(",\"sonarDistanceCm\":"));
  if (foodKnown()) tenths(Serial, distanceTenthsCm); else Serial.print(F("null"));
  Serial.print(F(",\"sonarValidSamples\":")); Serial.print(validSamples);
  Serial.print(F(",\"rainAnalog\":")); Serial.print(rainRaw);
  Serial.print(F(",\"rainDigital\":")); Serial.print(rainDigital);
  Serial.print(F(",\"waterAnalog\":")); Serial.print(waterRaw);
  Serial.print(F(",\"temperatureC\":"));
  if (haveTemperature) printTemperature(Serial); else Serial.print(F("null"));
  Serial.print(F(",\"foodPercent\":"));
  if (foodKnown()) Serial.print(foodPercent()); else Serial.print(F("null"));
  Serial.print(F(",\"rainWet\":")); Serial.print(rainWet() ? F("true") : F("false"));
  Serial.print(F(",\"waterIndex\":")); Serial.print(normalized(waterRaw, WATER_DRY_RAW, WATER_WET_RAW));
  Serial.print(F(",\"encoderPosition\":")); Serial.print(reportedPosition);
  Serial.print(F(",\"buttonPressed\":")); Serial.print(digitalRead(ENCODER_SW) == LOW ? F("true") : F("false"));
  Serial.print(F(",\"screen\":")); Serial.print(screen);
  Serial.println('}');
}
void printHello() {
  Serial.print(F("{\"event\":\"hello\",\"firmware\":\"colony-monitor/1.2\",\"protocolVersion\":1,\"telemetryIntervalMs\":"));
  Serial.print(telemetryIntervalMs);
  Serial.print(F(",\"screenCount\":")); Serial.print(SCREEN_COUNT); Serial.println('}');
}
void handleSerialCommand(unsigned long now) {
  serialCommand[serialCommandLength] = '\0';
  if (strcmp(serialCommand, "A") == 0) { haveAck = true; lastAck = now; }
  else if (strcmp(serialCommand, "B") == 0) { haveBrowserAck = true; lastBrowserAck = now; }
  else if (strcmp(serialCommand, "HELLO") == 0) printHello();
  else if (strcmp(serialCommand, "SAMPLE") == 0) sampleRequested = true;
  else if (strncmp(serialCommand, "STREAM ", 7) == 0) {
    unsigned long interval = 0;
    bool valid = serialCommandLength > 7;
    for (uint8_t i = 7; i < serialCommandLength; ++i) {
      const char c = serialCommand[i];
      if (c < '0' || c > '9' || interval > 60000UL) { valid = false; break; }
      interval = interval * 10UL + (c - '0');
    }
    if (valid && interval >= 250 && interval <= 60000) {
      telemetryIntervalMs = interval;
      Serial.print(F("{\"event\":\"stream\",\"intervalMs\":")); Serial.print(interval); Serial.println('}');
    } else Serial.println(F("{\"event\":\"error\",\"message\":\"STREAM needs 250..60000 milliseconds\"}"));
  } else Serial.println(F("{\"event\":\"error\",\"message\":\"Unknown serial command\"}"));
}
void serviceGateway(unsigned long now) {
  while (Serial.available()) {
    const char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (serialCommandOverflow) Serial.println(F("{\"event\":\"error\",\"message\":\"Command too long\"}"));
      else if (serialCommandLength) handleSerialCommand(now);
      serialCommandLength = 0; serialCommandOverflow = false;
    } else if (!serialCommandOverflow) {
      if (serialCommandLength < sizeof(serialCommand) - 1) serialCommand[serialCommandLength++] = c;
      else serialCommandOverflow = true;
    }
  }
}
void writeLed(uint8_t pin, bool on, bool activeLow) { digitalWrite(pin, on != activeLow ? HIGH : LOW); }
void serviceLeds(unsigned long now) {
  const bool danger = (haveAnalog && ((foodKnown() && foodPercent() <= FOOD_LOW_PERCENT) || normalized(waterRaw, WATER_DRY_RAW, WATER_WET_RAW) >= WATER_ALERT_PERCENT)) ||
    (haveTemperature && (temperatureTenthsC >= TEMPERATURE_HOT_TENTHS_C || temperatureTenthsC <= TEMPERATURE_FREEZING_TENTHS_C));
  const bool watch = !foodKnown() || !haveAnalog || rainWet() || !haveTemperature || temperatureTenthsC <= TEMPERATURE_COLD_TENTHS_C;
  writeLed(TRAFFIC_R, danger, TRAFFIC_ACTIVE_LOW);
  writeLed(TRAFFIC_Y, !danger && watch, TRAFFIC_ACTIVE_LOW);
  writeLed(TRAFFIC_G, !danger && !watch, TRAFFIC_ACTIVE_LOW);
  writeLed(RGB_R, !foodKnown(), RGB_COMMON_ANODE);
  const bool linkRecent = uplinkRecent(now) || browserRecent(now);
  writeLed(RGB_G, linkRecent, RGB_COMMON_ANODE);
  writeLed(RGB_B, !linkRecent && (now / 500) % 2 == 0, RGB_COMMON_ANODE);
}
void setupDisplay() {
#if ENABLE_OLED
  lastDisplayAttempt = millis();
  Wire.begin();
  Wire.setWireTimeout(25000, true); Wire.clearWireTimeoutFlag();
  for (uint8_t address = 0x3C; address <= 0x3D; ++address) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() != 0) continue;
    display.begin(&Adafruit128x64, address); display.setFont(System5x7);
    display.invertDisplay(false); displayReady = true; return;
  }
  displayReady = false;
#endif
}
void serviceDisplay(unsigned long now) {
#if ENABLE_OLED
  if (!displayReady) { if (now - lastDisplayAttempt >= 60000) setupDisplay(); return; }
  if (now - lastDisplay < DISPLAY_INTERVAL_MS) return;
  lastDisplay = now; display.clear();
  display.print(F("COLONY WATCH ")); display.print(screen + 1); display.print('/'); display.println(SCREEN_COUNT);
  switch (screen) {
    case 0:
      display.println(F("FOOD RESERVE"));
      display.print(F("Hopper: "));
      if (foodKnown()) { display.print(foodPercent()); display.println('%'); } else display.println(F("UNKNOWN"));
      display.print(F("Headspace: "));
      if (foodKnown()) { tenths(display, distanceTenthsCm); display.println(F(" cm")); } else display.println(F("no echo"));
      display.print(F("Valid echoes: ")); display.print(validSamples); display.println(F("/5"));
      display.println(F("Estimate, not eaten"));
      display.println(foodKnown() && foodPercent() <= FOOD_LOW_PERCENT ? F("ACTION: refill check") : F("Check food on visits"));
      break;
    case 1:
      display.println(F("RAIN / SURFACE WET"));
      display.print(F("Plate: ")); display.println(!haveAnalog ? F("waiting") : (rainWet() ? F("WET") : F("DRY")));
      display.print(F("AO A1: ")); display.println(rainRaw);
      display.print(F("DO A0: ")); display.println(rainDigital == LOW ? F("LOW") : F("HIGH"));
      display.println(F("No temp or humidity"));
      display.println(F("Wet? Check shelter"));
      break;
    case 2:
      display.println(F("STANDING WATER"));
      display.print(F("Probe A2: ")); display.println(waterRaw);
      display.print(F("Wetness index: ")); display.println(normalized(waterRaw, WATER_DRY_RAW, WATER_WET_RAW));
      display.println(F("Index is NOT depth"));
      display.println(F("Not drinking quality"));
      display.println(F("Wet? Inspect access"));
      break;
    case 3:
      display.println(F("STATION HEALTH"));
      display.println(uplinkRecent(now) ? F("Saved ACK: recent") : (browserRecent(now) ? F("Browser ACK: recent") : F("USB link: waiting")));
      display.print(F("Packets: ")); display.println(sequence);
      display.print(F("Uptime min: ")); display.println(now / 60000);
      display.println(F("USB -> browser/Node"));
      display.println(F("Sensing stays active"));
      break;
    default:
      display.println(F("STATION TEMPERATURE"));
      display.print(F("Ambient: "));
      if (haveTemperature) { printTemperature(display); display.println(F(" C")); } else display.println(F("UNKNOWN"));
      display.println(F("DHT11 on D7"));
      display.println(F("Not cat body temp"));
      display.println(!haveTemperature ? F("Check thermometer") : temperatureTenthsC <= TEMPERATURE_FREEZING_TENTHS_C ? F("FREEZE: warm shelter") :
        temperatureTenthsC <= TEMPERATURE_COLD_TENTHS_C ? F("COLD: dry shelter") : temperatureTenthsC >= TEMPERATURE_HOT_TENTHS_C ? F("HEAT: shade + water") : F("No temperature alert"));
      display.println(F("Verify frost rating"));
      break;
  }
  display.print(F("Turn ")); display.print(screenTravel); display.print('/'); display.print(ENCODER_DETENTS_PER_SCREEN); display.print(F(" -> view"));
  if (Wire.getWireTimeoutFlag()) displayReady = false;
#else
  (void)now;
#endif
}
void setup() {
  const uint8_t outputs[] = {TRAFFIC_R, TRAFFIC_Y, TRAFFIC_G, RGB_R, RGB_G, RGB_B};
  for (uint8_t i = 0; i < 6; ++i) {
    writeLed(outputs[i], false, i < 3 ? TRAFFIC_ACTIVE_LOW : RGB_COMMON_ANODE); pinMode(outputs[i], OUTPUT);
  }
  pinMode(ENCODER_DT, INPUT_PULLUP); pinMode(ENCODER_CLK, INPUT_PULLUP); pinMode(ENCODER_SW, INPUT_PULLUP);
  previousState = (digitalRead(ENCODER_CLK) << 1) | digitalRead(ENCODER_DT);
  attachInterrupt(digitalPinToInterrupt(ENCODER_DT), encoderChanged, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENCODER_CLK), encoderChanged, CHANGE);
  digitalWrite(SONAR_TRIG, LOW); pinMode(SONAR_TRIG, OUTPUT); pinMode(SONAR_ECHO, INPUT);
  pinMode(WATER_SIGNAL, INPUT); pinMode(RAIN_AO, INPUT); pinMode(RAIN_DO, INPUT_PULLUP);
  Serial.begin(115200);
  Serial.println(F("{\"event\":\"boot\",\"firmware\":\"colony-monitor/1.2\"}"));
  thermometer.begin(); lastTemperature = millis();
  setupDisplay();
}
void loop() {
  serviceEncoder();
  const unsigned long now = millis();
  serviceGateway(now); serviceSonar(now); serviceAnalog(now); serviceTemperature(now);
  serviceTelemetry(now); serviceLeds(now); serviceDisplay(now);
}
