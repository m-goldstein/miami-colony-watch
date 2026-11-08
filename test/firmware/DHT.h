#pragma once
#include "Arduino.h"
#define DHT11 11
float simulatedTemperatureC = 26.0f;
unsigned temperatureReads = 0;
class DHT {
public:
  bool started = false;
  explicit DHT(uint8_t pin, uint8_t type) { assert(pin == 7 && type == DHT11); }
  void begin() { started = true; }
  float readTemperature() { assert(started); ++temperatureReads; return simulatedTemperatureC; }
};
