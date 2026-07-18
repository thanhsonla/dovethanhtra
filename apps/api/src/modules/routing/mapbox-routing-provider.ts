import type { GeoJsonGeometry, RouteCandidate, RoutePosition, RouteRequest } from '@dove/contracts'

import {
  RoutingProviderError,
  type ProviderRouteResult,
  type RoutingProvider,
} from './routing-provider.js'

interface MapboxResponse {
  code?: string
  message?: string
  routes?: Array<{
    distance: number
    duration: number
    geometry: GeoJsonGeometry
    legs: Array<{ distance: number; duration: number }>
    weight_name?: string
  }>
}

export class MapboxRoutingProvider implements RoutingProvider {
  readonly id = 'mapbox-directions-v5'

  constructor(
    private readonly token: string,
    private readonly timeoutMs: number,
  ) {}

  async calculate(request: RouteRequest): Promise<ProviderRouteResult> {
    const coordinates: RoutePosition[] = [request.origin, ...request.waypoints, request.destination]
    const profile = request.profile === 'driving-traffic' ? 'driving-traffic' : 'driving'
    const path = coordinates.map((position) => position.join(',')).join(';')
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${path}`)
    url.searchParams.set('access_token', this.token)
    url.searchParams.set('alternatives', request.alternatives ? 'true' : 'false')
    url.searchParams.set('geometries', 'geojson')
    url.searchParams.set('overview', 'full')
    url.searchParams.set('steps', 'false')
    let response: Response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new RoutingProviderError(
          'ROUTING_TIMEOUT',
          'Nhà cung cấp định tuyến phản hồi quá hạn.',
        )
      }
      throw new RoutingProviderError(
        'ROUTING_PROVIDER_UNAVAILABLE',
        'Không kết nối được nhà cung cấp định tuyến.',
      )
    }
    if (response.status === 429) {
      throw new RoutingProviderError(
        'ROUTING_QUOTA_EXCEEDED',
        'Đã vượt hạn mức định tuyến; vui lòng thử lại sau.',
      )
    }
    const payload = (await response.json().catch(() => ({}))) as MapboxResponse
    if (!response.ok) {
      const noRoute = payload.code === 'NoRoute' || payload.code === 'NoSegment'
      throw new RoutingProviderError(
        noRoute ? 'ROUTE_NOT_FOUND' : 'ROUTING_PROVIDER_UNAVAILABLE',
        noRoute ? 'Không tìm được lộ trình phù hợp.' : 'Nhà cung cấp định tuyến từ chối yêu cầu.',
      )
    }
    if (payload.code !== 'Ok' || !payload.routes?.length) {
      throw new RoutingProviderError('ROUTE_NOT_FOUND', 'Không tìm được lộ trình phù hợp.')
    }
    const candidates: RouteCandidate[] = payload.routes.map((route) => ({
      distanceM: route.distance,
      durationS: route.duration,
      geometry: route.geometry,
      legs: route.legs.map((leg, index) => ({
        index,
        from: coordinates[index]!,
        to: coordinates[index + 1]!,
        distanceM: leg.distance,
        durationS: leg.duration,
      })),
      warnings: [],
    }))
    return {
      candidates,
      calculatedAt: new Date().toISOString(),
      metadata: { profile, apiVersion: 5 },
    }
  }

  async healthcheck(): Promise<boolean> {
    return Boolean(this.token)
  }
}
