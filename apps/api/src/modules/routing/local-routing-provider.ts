import type { RouteLeg, RoutePosition, RouteRequest } from '@dove/contracts'

import type { ProviderRouteResult, RoutingProvider } from './routing-provider.js'

function distanceM(a: RoutePosition, b: RoutePosition): number {
  const radius = 6_371_008.8
  const latitude1 = (a[1] * Math.PI) / 180
  const latitude2 = (b[1] * Math.PI) / 180
  const deltaLatitude = ((b[1] - a[1]) * Math.PI) / 180
  const deltaLongitude = ((b[0] - a[0]) * Math.PI) / 180
  const h =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export class LocalRoutingProvider implements RoutingProvider {
  readonly id = 'local-deterministic'

  async calculate(request: RouteRequest): Promise<ProviderRouteResult> {
    const coordinates = [request.origin, ...request.waypoints, request.destination]
    const legs: RouteLeg[] = coordinates.slice(1).map((to, index) => {
      const from = coordinates[index]!
      const legDistance = distanceM(from, to)
      return { index, from, to, distanceM: legDistance, durationS: legDistance / 8.333333 }
    })
    const totalDistance = legs.reduce((sum, leg) => sum + leg.distanceM, 0)
    return {
      calculatedAt: new Date().toISOString(),
      candidates: [
        {
          distanceM: totalDistance,
          durationS: legs.reduce((sum, leg) => sum + leg.durationS, 0),
          geometry: { type: 'LineString', coordinates },
          legs,
          warnings: ['LOCAL_PROVIDER_NOT_FOR_OFFICIAL_USE'],
        },
      ],
      metadata: { algorithm: 'great-circle-straight-line-v1' },
    }
  }

  async healthcheck(): Promise<boolean> {
    return true
  }
}
