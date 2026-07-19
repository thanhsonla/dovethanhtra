import type { GpsPoint } from '@dove/contracts'

export function pointFromPosition(position: GeolocationPosition): GpsPoint {
  const now = Date.now()
  const timestamp =
    Number.isFinite(position.timestamp) &&
    position.timestamp >= Date.UTC(2000, 0, 1) &&
    position.timestamp <= now + 60_000
      ? position.timestamp
      : now
  return {
    position: [position.coords.longitude, position.coords.latitude],
    recordedAt: new Date(timestamp).toISOString(),
    accuracyM: Number.isFinite(position.coords.accuracy)
      ? Math.min(10000, Math.max(0, position.coords.accuracy))
      : 1000,
    ...(typeof position.coords.altitude === 'number' && Number.isFinite(position.coords.altitude)
      ? { altitudeM: position.coords.altitude }
      : {}),
    ...(typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed)
      ? { speedMps: Math.max(0, position.coords.speed) }
      : {}),
  }
}
