// The presentation sandbox never sends frames to the serial port or ingestion API.
import { temperatureState, TEMPERATURE_ALERTS } from './temperature.js';
export const scenarios = {
  calm: { label: 'A good day', food: 72, rain: false, water: 6, online: true },
  food: { label: 'Food running low', food: 14, rain: false, water: 6, online: true },
  refill: { label: 'Reserve refilled', food: 92, rain: false, water: 6, online: true },
  rain: { label: 'Rain rolls in', food: 72, rain: true, water: 18, online: true },
  water: { label: 'Water rising', food: 72, rain: true, water: 84, online: true },
  hot: { label: 'Heat risk', food: 72, rain: false, water: 6, online: true, temperatureC: 36 },
  cold: { label: 'Cold risk', food: 72, rain: false, water: 6, online: true, temperatureC: 5 },
  freezing: { label: 'Freezing conditions', food: 72, rain: false, water: 6, online: true, temperatureC: -2 },
  offline: { label: 'Station offline', food: 72, rain: false, water: 6, online: false }
};
export function demoReading(scenario, sequence = 0) {
  const s = scenarios[scenario];
  if (!s) throw new Error('Unknown demo scenario');
  return { schemaVersion: 1, sequence, uptimeMs: sequence * 1000, sonarDistanceCm: +(30 - s.food * 0.25).toFixed(1),
    sonarValidSamples: 5, foodPercent: s.food, rainAnalog: s.rain ? 250 : 900, rainDigital: s.rain ? 0 : 1,
    rainWet: s.rain, waterAnalog: Math.round(100 + s.water * 7), waterIndex: s.water,
    temperatureC: s.temperatureC ?? 26,
    encoderPosition: 0, buttonPressed: false, screen: 0 };
}
export function careState(reading, fresh) {
  if (!fresh || !reading) return { kind: 'offline', title: 'Let’s check the connection.',
    detail: 'The station needs fresh readings before we can plan from its sensors.', action: 'Check the station', badge: 'Reading unavailable', checks: 1 };
  const lowFood = reading.foodPercent != null && reading.foodPercent <= 25;
  const wet = reading.rainWet === true, water = reading.waterIndex != null && reading.waterIndex >= 60;
  const unknown = reading.foodPercent == null;
  const temperature = temperatureState(reading.temperatureC), temperatureAlert = TEMPERATURE_ALERTS[temperature];
  const checks = [lowFood, wet, water, unknown, !!temperatureAlert].filter(Boolean).length;
  if (temperature === 'hot' || temperature === 'freezing') return { ...temperatureAlert, kind: temperature, checks };
  if (water) return { kind: 'water', title: 'Water at the station. Time for a check.', detail: 'Inspect the station base and shelter when access is safe. This probe cannot certify flood conditions.', action: 'Log a water check', badge: 'Station check needed', checks };
  if (temperature === 'cold') return { ...temperatureAlert, kind: temperature, checks };
  if (lowFood) return { kind: 'food', title: 'A little top-up would go a long way.', detail: 'The reserve is running low. Plan a refill and check the food in person.', action: 'Plan a refill visit', badge: 'Food running low', checks };
  if (unknown) return { kind: 'unknown', title: 'The food reading needs a human eye.', detail: 'No reliable echo is available. Check the hopper and sensor before assuming it is empty.', action: 'Log a station check', badge: 'Food estimate unknown', checks };
  if (wet) return { kind: 'rain', title: 'Rain’s here. Keep their corner covered.', detail: 'The rain plate is wet. A caregiver can check that the food and shelter stay protected.', action: 'Log a shelter check', badge: 'Shelter check needed', checks };
  if (temperatureAlert) return { ...temperatureAlert, kind: 'temperature-unknown', checks };
  return { kind: 'calm', title: 'The little signals look settled.', detail: 'The reserve has food and the probes show no alert. Regular visits still make the difference.', action: 'Log a care visit', badge: 'No sensor alerts', checks: 0 };
}
