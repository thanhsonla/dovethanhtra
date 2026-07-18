import type { RouteCandidate, RouteRequest } from '@dove/contracts'

export interface ProviderRouteResult {
  candidates: RouteCandidate[]
  calculatedAt: string
  metadata: Record<string, unknown>
}

export interface RoutingProvider {
  readonly id: string
  calculate(request: RouteRequest): Promise<ProviderRouteResult>
  healthcheck(): Promise<boolean>
}

export class RoutingProviderError extends Error {
  constructor(
    public readonly code:
      | 'ROUTE_NOT_FOUND'
      | 'ROUTING_TIMEOUT'
      | 'ROUTING_QUOTA_EXCEEDED'
      | 'ROUTING_PROVIDER_UNAVAILABLE',
    message: string,
  ) {
    super(message)
  }
}
