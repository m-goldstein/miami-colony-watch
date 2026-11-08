#pragma once
#include <stdint.h>
struct FakeWire {
  uint8_t acknowledgedAddress = 0x3C;
  uint8_t requestedAddress = 0;
  bool timedOut = false;
  void begin() {}
  void setWireTimeout(unsigned long, bool) {}
  void clearWireTimeoutFlag() { timedOut = false; }
  bool getWireTimeoutFlag() { return timedOut; }
  void beginTransmission(uint8_t address) { requestedAddress = address; }
  uint8_t endTransmission() { return requestedAddress == acknowledgedAddress ? 0 : 2; }
} Wire;
