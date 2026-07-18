import { randomUUID } from 'node:crypto'

import type {
  AdminArea,
  TreatmentFacility,
  TransportRoute,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { LocalRoutingProvider } from '../src/modules/routing/local-routing-provider.js'
import {
  RoutingProviderError,
  type RoutingProvider,
} from '../src/modules/routing/routing-provider.js'
import { createDatabase, type DatabaseHandle } from '../src/platform/database.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests.')

class SwitchableProvider implements RoutingProvider {
  readonly id = 'integration-routing-provider'
  fail = false
  private readonly local = new LocalRoutingProvider()
  async calculate(request: Parameters<RoutingProvider['calculate']>[0]) {
    if (this.fail)
      throw new RoutingProviderError('ROUTE_NOT_FOUND', 'Không tìm được lộ trình kiểm thử.')
    return this.local.calculate(request)
  }
  async healthcheck() {
    return true
  }
}

let database: DatabaseHandle
let app: Awaited<ReturnType<typeof buildApp>>
const provider = new SwitchableProvider()

beforeAll(async () => {
  database = createDatabase(databaseUrl)
  app = await buildApp({
    auth: { cookieSecure: false, sessionTtlHours: 1 },
    dependencies: { database, objectStorage: { check: async () => true } },
    routing: { provider, requestsPerMinute: 100 },
  })
})

afterAll(async () => {
  await app.close()
  await database.destroy()
})

describe('Milestone 3 routing workflow', () => {
  it('saves an official server route, versions recalculation and handles no-route', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: process.env.BOOTSTRAP_OWNER_EMAIL,
        password: process.env.BOOTSTRAP_OWNER_PASSWORD,
      },
    })
    const session = login.cookies.find((item) => item.name === 'dove_session')!
    const csrf = login.cookies.find((item) => item.name === 'dove_csrf')!
    const cookie = `dove_session=${session.value}; dove_csrf=${csrf.value}`
    const headers = { cookie, 'x-csrf-token': csrf.value }
    const areas = (
      await app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/admin-areas' })
    ).json<AdminArea[]>()
    const types = (
      await app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/catalog/work-types' })
    ).json<WorkType[]>()
    const facilitiesResponse = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: '/api/v1/treatment-facilities',
    })
    expect(facilitiesResponse.statusCode).toBe(200)
    const facility = facilitiesResponse.json<TreatmentFacility[]>()[0]!
    const suffix = randomUUID().slice(0, 8)
    const createdCase = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: areas[0]!.id,
        caseCode: `M3-${suffix}`,
        name: `Route ${suffix}`,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      },
    })
    const testCaseId = createdCase.json<{ id: string }>().id
    const workResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${testCaseId}/work-items`,
      payload: {
        name: 'Vận chuyển route kiểm thử',
        workTypeId: types.find((item) => item.code === 'WASTE_ROUTE_DISTANCE')!.id,
      },
    })
    const work = workResponse.json<WorkItem>()
    const request = {
      origin: [104.65, 20.8],
      destination: facility.location,
      waypoints: [[104.68, 20.81]],
      profile: 'driving',
      alternatives: true,
    }

    const preview = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/routes/calculate',
      payload: request,
    })
    expect(preview.statusCode).toBe(200)
    expect(preview.json()).toMatchObject({ provider: provider.id })

    const mismatch = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/routes`,
      payload: {
        name: 'Route sai điểm cuối',
        request: { ...request, destination: [104.7, 20.8] },
        candidateIndex: 0,
        treatmentFacilityId: facility.id,
        returnFactor: 1,
        tripCount: 1,
      },
    })
    expect(mismatch.statusCode).toBe(422)
    expect(mismatch.json()).toMatchObject({ code: 'ROUTE_DESTINATION_FACILITY_MISMATCH' })

    const savedResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/routes`,
      payload: {
        name: 'Route phiên bản 1',
        request,
        candidateIndex: 0,
        treatmentFacilityId: facility.id,
        returnFactor: 2,
        tripCount: 5,
      },
    })
    expect(savedResponse.statusCode).toBe(201)
    const saved = savedResponse.json<TransportRoute>()
    expect(saved.measurement).toMatchObject({
      geometryKind: 'route',
      status: 'confirmed',
      version: 1,
    })
    expect(saved.vehicleKm).toBeCloseTo((saved.distanceOneWayM / 1000) * 10, 8)
    expect(saved.requestFingerprint).toHaveLength(64)
    expect(saved.legs).toHaveLength(2)

    const recalculatedResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/routes/${saved.id}/recalculate`,
      payload: { reason: 'Đối chứng phiên bản mới' },
    })
    expect(recalculatedResponse.statusCode).toBe(201)
    const recalculated = recalculatedResponse.json<TransportRoute>()
    expect(recalculated.measurement).toMatchObject({
      version: 2,
      supersedesId: saved.measurement.id,
    })
    expect(recalculated.id).not.toBe(saved.id)
    const measurements = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/work-items/${work.id}/measurements`,
    })
    expect(measurements.json<{ items: Array<{ id: string; status: string }> }>().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: saved.measurement.id, status: 'superseded' }),
        expect.objectContaining({ id: recalculated.measurement.id, status: 'confirmed' }),
      ]),
    )

    const weighted = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/routes/weighted-distance',
      payload: {
        routes: [
          { distanceKm: 10, weightTon: 3 },
          { distanceKm: 20, weightTon: 7 },
        ],
      },
    })
    expect(weighted.json()).toEqual({ weightedDistanceKm: 17, warnings: [] })

    provider.fail = true
    const noRoute = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/routes/calculate',
      payload: request,
    })
    provider.fail = false
    expect(noRoute.statusCode).toBe(422)
    expect(noRoute.json()).toMatchObject({ code: 'ROUTE_NOT_FOUND' })
  })
})
