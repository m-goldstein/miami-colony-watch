#pragma once
#include <Arduino.h>
struct SSD1306AsciiWire : FakePrint {
  bool inverted = false;
  unsigned clears = 0;
  void begin(const int*, uint8_t) {}
  void setFont(int) {}
  void invertDisplay(bool value) { inverted = value; }
  void clear() { output.clear(); ++clears; }
};
