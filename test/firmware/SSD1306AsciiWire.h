#pragma once
#include <Arduino.h>
#include <cassert>
struct SSD1306AsciiWire : FakePrint {
  bool inverted = false;
  unsigned clears = 0, writes = 0;
  uint8_t cursorColumn = 0, cursorRow = 0, scrollMode = 255;
  std::string rows[8];
  void begin(const int*, uint8_t) { clear(); }
  void setFont(int) {}
  void setScrollMode(uint8_t mode) { scrollMode = mode; }
  void invertDisplay(bool value) { inverted = value; }
  void clear() { for (auto& row : rows) row.assign(21, ' '); ++clears; }
  void setCursor(uint8_t x, uint8_t row) {
    assert(x % 6 == 0 && x <= 120 && row < 8);
    cursorColumn = x / 6; cursorRow = row;
  }
  size_t write(uint8_t value) override {
    // A newline, wrapping, or off-screen write would move existing content.
    assert(value >= 32 && value <= 126 && cursorColumn < 21);
    rows[cursorRow][cursorColumn++] = value; ++writes;
    return 1;
  }
  std::string text() const {
    std::string value;
    for (unsigned row = 0; row < 8; ++row) {
      if (row) value += '\n';
      value += rows[row];
    }
    return value;
  }
};
