import type { WeightedDistanceResponse } from '@dove/contracts'

export function routeQuantities(
  distanceM: number,
  returnFactor: number,
  tripCount: number,
  weightTon?: number,
) {
  const effectiveKm = (distanceM / 1000) * returnFactor
  return {
    distanceOneWayKm: distanceM / 1000,
    effectiveKm,
    vehicleKm: effectiveKm * tripCount,
    tonKm: weightTon === undefined ? null : effectiveKm * weightTon,
  }
}

export function weightedDistance(
  routes: Array<{ distanceKm: number; weightTon: number }>,
): WeightedDistanceResponse {
  const totalWeight = routes.reduce((sum, route) => sum + route.weightTon, 0)
  if (totalWeight === 0) return { weightedDistanceKm: null, warnings: ['MISSING_TRANSPORT_WEIGHT'] }
  return {
    weightedDistanceKm:
      routes.reduce((sum, route) => sum + route.distanceKm * route.weightTon, 0) / totalWeight,
    warnings: [],
  }
}
