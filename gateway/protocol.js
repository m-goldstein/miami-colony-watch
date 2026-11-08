import { validateReading } from '../server/domain.js';
export function frameToPacket(frame, { deviceId, bootId, receivedAt = new Date().toISOString() }) {
  return validateReading({ ...frame, deviceId, bootId, sampledAt: receivedAt });
}
