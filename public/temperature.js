// Ambient station inspection triggers, not feline body-temperature limits.
// Keep the firmware's TEMPERATURE_* constants in sync with these defaults.
export const TEMPERATURE_LIMITS = Object.freeze({ coldC: 7, freezingC: 0, hotC: 32 });
export const validTemperature = value => typeof value === 'number' && Number.isFinite(value) && value >= -20 && value <= 60;
export function temperatureState(value) {
  if (!validTemperature(value)) return 'unknown';
  if (value <= TEMPERATURE_LIMITS.freezingC) return 'freezing';
  if (value <= TEMPERATURE_LIMITS.coldC) return 'cold';
  if (value >= TEMPERATURE_LIMITS.hotC) return 'hot';
  return 'normal';
}
export function temperatureLabel(value) {
  return validTemperature(value) ? `${value.toFixed(1)}°C / ${(value * 9 / 5 + 32).toFixed(1)}°F` : 'Unknown';
}
export const TEMPERATURE_ALERTS = Object.freeze({
  hot: { title: 'Heat risk: check on the cats.', detail: 'The station is hot. Check the cats, provide shade and fresh drinking water, and arrange a cooler shelter. Contact a veterinarian promptly if a cat shows distress.', action: 'Log a heat check', badge: 'Heat risk' },
  cold: { title: 'Cold risk: check their shelter.', detail: 'The station is cold. Check the cats and provide dry, insulated shelter and drinking water. Kittens, older cats, and unwell cats may need extra help.', action: 'Log a cold check', badge: 'Cold risk' },
  freezing: { title: 'Freezing conditions: check on the cats now.', detail: 'The station is at or below freezing. Arrange warm, dry shelter and check drinking water for ice. Contact a veterinarian promptly if a cat shows distress.', action: 'Log a freezing-weather check', badge: 'Freezing risk' },
  unknown: { title: 'The thermometer needs a check.', detail: 'No valid temperature reading is available. Check the DHT11 sensor and assess the cats and shelter in person.', action: 'Log a thermometer check', badge: 'Temperature unknown' }
});
