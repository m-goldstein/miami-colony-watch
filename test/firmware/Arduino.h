#pragma once
#include <stdint.h>
#include <sstream>
#include <string>
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define INPUT 0
#define INPUT_PULLUP 2
#define CHANGE 3
#define HEX 16
class __FlashStringHelper;
#define F(s) reinterpret_cast<const __FlashStringHelper*>(s)
#define A0 14
#define A1 15
#define A2 16
uint16_t analogValues[32] = {};
unsigned analogCalls[32] = {};
int analogRead(uint8_t pin) { ++analogCalls[pin]; return analogValues[pin]; }
unsigned long simulatedNow = 0;
uint8_t pinValues[32] = {};
uint8_t pinModes[32] = {};
void (*handlers[32])() = {};
unsigned long millis() { return simulatedNow; }
void digitalWrite(uint8_t pin, uint8_t value) { pinValues[pin] = value; }
int digitalRead(uint8_t pin) { return pinValues[pin]; }
void pinMode(uint8_t pin, uint8_t mode) { pinModes[pin] = mode; if (mode == INPUT_PULLUP) pinValues[pin] = HIGH; }
int digitalPinToInterrupt(uint8_t pin) { return pin; }
void attachInterrupt(int pin, void (*handler)(), int) { handlers[pin] = handler; }
void noInterrupts() {}
void interrupts() {}
unsigned long simulatedPrintDelayMs = 0;
struct Print {
  std::string output;
  void print(char value) { output += value; }
  void print(const char* value) { output += value; }
  void print(const __FlashStringHelper* value) { output += reinterpret_cast<const char*>(value); }
  template<class T> void print(T value) { std::ostringstream s; s << +value; output += s.str(); }
  template<class T> void print(T value, int base) { std::ostringstream s; if (base == HEX) s << std::hex; s << +value; output += s.str(); }
  void println() { simulatedNow += simulatedPrintDelayMs; output += '\n'; }
  template<class T> void println(T value) { print(value); println(); }
  template<class T> void println(T value, int base) { print(value, base); println(); }
};
using FakePrint = Print;
struct FakeSerial : Print {
  std::string input;
  unsigned long baud = 0;
  void begin(unsigned long value) { baud = value; }
  int available() { return input.size(); }
  int read() { const char c = input[0]; input.erase(0, 1); return c; }
} Serial;

#include <vector>
unsigned long simulatedEchoUs = 1160;
unsigned sonarPulseCalls = 0;
std::vector<unsigned> triggerDelays;
void delayMicroseconds(unsigned value) { triggerDelays.push_back(value); }
unsigned long pulseIn(uint8_t pin, uint8_t level, unsigned long timeout) {
  if (pin != 6 || level != HIGH || timeout != 30000 || pinValues[5] != LOW)
    throw "Incorrect sonar pulse configuration";
  ++sonarPulseCalls;
  return simulatedEchoUs;
}
