import { randomUUID } from 'node:crypto'

import type {
  AdminArea,
  CaseListResponse,
  Measurement,
  MeasurementListResponse,
  ServiceGroup,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { createDatabase, type DatabaseHandle } from '../src/platform/database.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests.')

let database: DatabaseHandle
let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  database = createDatabase(databaseUrl)
  app = await buildApp({
    auth: { cookieSecure: false, sessionTtlHours: 1 },
    dependencies: { database, objectStorage: { check: async () => true } },
  })
})

afterAll(async () => {
  await app.close()
  await database.destroy()
})

describe('Milestone 1 API workflow', () => {
  it('authenticates, creates a case and snapshots a catalog work item with audit', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: process.env.BOOTSTRAP_OWNER_EMAIL,
        password: process.env.BOOTSTRAP_OWNER_PASSWORD,
      },
    })
    expect(login.statusCode).toBe(200)
    const sessionCookie = login.cookies.find((cookie) => cookie.name === 'dove_session')
    const csrfCookie = login.cookies.find((cookie) => cookie.name === 'dove_csrf')
    expect(sessionCookie).toBeDefined()
    expect(csrfCookie).toBeDefined()
    const cookie = `dove_session=${sessionCookie!.value}; dove_csrf=${csrfCookie!.value}`
    const authHeaders = { cookie, 'x-csrf-token': csrfCookie!.value }

    const [areasResponse, groupsResponse, typesResponse] = await Promise.all([
      app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/admin-areas' }),
      app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/catalog/service-groups' }),
      app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/catalog/work-types' }),
    ])
    expect(areasResponse.statusCode).toBe(200)
    expect(groupsResponse.statusCode).toBe(200)
    expect(typesResponse.statusCode).toBe(200)
    const areas = areasResponse.json<AdminArea[]>()
    const groups = groupsResponse.json<ServiceGroup[]>()
    const workTypes = typesResponse.json<WorkType[]>()
    expect(groups).toHaveLength(6)
    expect(workTypes.length).toBeGreaterThanOrEqual(15)

    const suffix = randomUUID().slice(0, 8)
    const createdResponse = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: areas[0]!.id,
        caseCode: `M1-TEST-${suffix}`,
        name: `Hồ sơ kiểm thử ${suffix}`,
        periodEnd: '2026-07-31',
        periodStart: '2026-07-01',
      },
    })
    expect(createdResponse.statusCode).toBe(201)
    const created = createdResponse.json<{ id: string; version: number }>()
    expect(created.version).toBe(1)

    const itemResponse = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: `/api/v1/cases/${created.id}/work-items`,
      payload: { name: 'Công tác kiểm thử', workTypeId: workTypes[0]!.id },
    })
    expect(itemResponse.statusCode).toBe(201)
    expect(itemResponse.json()).toMatchObject({
      caseId: created.id,
      unit: workTypes[0]!.baseUnit,
      workTypeCode: workTypes[0]!.code,
    })

    const updateResponse = await app.inject({
      headers: { ...authHeaders, 'if-match': '"1"' },
      method: 'PATCH',
      url: `/api/v1/cases/${created.id}`,
      payload: { status: 'in_progress' },
    })
    expect(updateResponse.statusCode).toBe(200)
    expect(updateResponse.json()).toMatchObject({ status: 'in_progress', version: 2 })

    const staleUpdate = await app.inject({
      headers: { ...authHeaders, 'if-match': '"1"' },
      method: 'PATCH',
      url: `/api/v1/cases/${created.id}`,
      payload: { name: 'Tên sửa bằng phiên bản cũ' },
    })
    expect(staleUpdate.statusCode).toBe(409)
    expect(staleUpdate.json()).toMatchObject({ code: 'VERSION_CONFLICT' })

    const auditResponse = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${created.id}/audit-events`,
    })
    expect(auditResponse.statusCode).toBe(200)
    expect(auditResponse.json<Array<{ action: string }>>().map((event) => event.action)).toEqual(
      expect.arrayContaining(['created', 'updated']),
    )

    const listResponse = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: '/api/v1/cases',
    })
    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json<CaseListResponse>().items.some((item) => item.id === created.id)).toBe(
      true,
    )
  })
})

describe('Milestone 2 measurement workflow', () => {
  it('calculates standard geometries, warnings, confirmation totals and superseding', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: process.env.BOOTSTRAP_OWNER_EMAIL,
        password: process.env.BOOTSTRAP_OWNER_PASSWORD,
      },
    })
    const sessionCookie = login.cookies.find((item) => item.name === 'dove_session')!
    const csrfCookie = login.cookies.find((item) => item.name === 'dove_csrf')!
    const cookie = `dove_session=${sessionCookie.value}; dove_csrf=${csrfCookie.value}`
    const headers = { cookie, 'x-csrf-token': csrfCookie.value }

    const areas = (
      await app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/admin-areas' })
    ).json<AdminArea[]>()
    const workTypes = (
      await app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/catalog/work-types' })
    ).json<WorkType[]>()
    const suffix = randomUUID().slice(0, 8)
    const createdCase = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: areas[0]!.id,
        caseCode: `M2-TEST-${suffix}`,
        name: `Hồ sơ không gian ${suffix}`,
        periodEnd: '2026-07-31',
        periodStart: '2026-07-01',
      },
    })
    const caseId = createdCase.json<{ id: string }>().id

    const createWorkItem = async (code: string) => {
      const workType = workTypes.find((item) => item.code === code)!
      const response = await app.inject({
        headers,
        method: 'POST',
        url: `/api/v1/cases/${caseId}/work-items`,
        payload: { name: `Công tác ${code}`, workTypeId: workType.id },
      })
      expect(response.statusCode).toBe(201)
      return response.json<WorkItem>()
    }
    const lineWork = await createWorkItem('LIGHTING_CABLE_LENGTH')
    const areaWork = await createWorkItem('SIDEWALK_REPAIR_AREA')

    const createMeasurement = async (workItemId: string, payload: Record<string, unknown>) => {
      const response = await app.inject({
        headers,
        method: 'POST',
        url: `/api/v1/work-items/${workItemId}/measurements`,
        payload,
      })
      expect(response.statusCode).toBe(201)
      return response.json<Measurement>()
    }
    const confirm = async (id: string) => {
      const response = await app.inject({
        headers,
        method: 'POST',
        url: `/api/v1/measurements/${id}/confirm`,
        payload: {},
      })
      expect(response.statusCode).toBe(200)
      return response.json<Measurement>()
    }

    const standardLine = {
      coordinates: [
        [104.65, 20.8],
        [104.65961, 20.8],
      ],
      type: 'LineString',
    }
    const lineOne = await createMeasurement(lineWork.id, {
      geometry: standardLine,
      geometryKind: 'line',
      name: 'Tuyến chuẩn 1',
    })
    expect(lineOne.baseValue).toBeGreaterThan(998)
    expect(lineOne.baseValue).toBeLessThan(1_002)
    await confirm(lineOne.id)

    const lineTwo = await createMeasurement(lineWork.id, {
      geometry: standardLine,
      geometryKind: 'line',
      name: 'Tuyến trùng',
    })
    expect(lineTwo.warnings.map((warning) => warning.code)).toContain('OVERLAP_DETECTED')
    await confirm(lineTwo.id)

    const lineThree = await createMeasurement(lineWork.id, {
      geometry: {
        coordinates: [
          [104.65, 20.802],
          [104.65961, 20.802],
        ],
        type: 'LineString',
      },
      geometryKind: 'line',
      name: 'Tuyến chuẩn 3',
    })
    await confirm(lineThree.id)
    const lineList = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/work-items/${lineWork.id}/measurements`,
    })
    const lineSummary = lineList.json<MeasurementListResponse>()
    expect(lineSummary.items).toHaveLength(3)
    expect(lineSummary.confirmedTotal).toBeGreaterThan(2_994)
    expect(lineSummary.confirmedTotal).toBeLessThan(3_006)

    const standardArea = await createMeasurement(areaWork.id, {
      geometry: {
        coordinates: [
          [
            [104.67, 20.8],
            [104.670961, 20.8],
            [104.670961, 20.800904],
            [104.67, 20.800904],
            [104.67, 20.8],
          ],
        ],
        type: 'Polygon',
      },
      geometryKind: 'area',
      name: 'Vùng chuẩn 1 ha',
    })
    expect(standardArea.baseValue).toBeGreaterThan(9_950)
    expect(standardArea.baseValue).toBeLessThan(10_050)

    const invalidArea = await createMeasurement(areaWork.id, {
      geometry: {
        coordinates: [
          [
            [104.68, 20.8],
            [104.681, 20.801],
            [104.681, 20.8],
            [104.68, 20.801],
            [104.68, 20.8],
          ],
        ],
        type: 'Polygon',
      },
      geometryKind: 'area',
      name: 'Vùng tự cắt',
    })
    expect(invalidArea.validationStatus).toBe('invalid')
    expect(invalidArea.normalizedGeometry).toBeNull()
    const invalidConfirm = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/measurements/${invalidArea.id}/confirm`,
      payload: {},
    })
    expect(invalidConfirm.statusCode).toBe(422)

    const outsideLine = await createMeasurement(lineWork.id, {
      geometry: {
        coordinates: [
          [104.74, 20.82],
          [104.76, 20.82],
        ],
        type: 'LineString',
      },
      geometryKind: 'line',
      name: 'Tuyến qua ranh giới',
    })
    expect(outsideLine.warnings.map((warning) => warning.code)).toContain('OUTSIDE_CASE_BOUNDARY')

    const superseded = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/measurements/${lineOne.id}/supersede`,
      payload: {
        geometry: {
          coordinates: [
            [104.65, 20.8],
            [104.658, 20.8],
          ],
          type: 'LineString',
        },
        geometryKind: 'line',
        name: 'Tuyến chuẩn 1 hiệu chỉnh',
        reason: 'Hiệu chỉnh điểm cuối theo kiểm tra lại',
      },
    })
    expect(superseded.statusCode, superseded.body).toBe(201)
    expect(superseded.json<Measurement>()).toMatchObject({
      code: lineOne.code,
      status: 'needs_attention',
      supersedesId: lineOne.id,
      version: 2,
    })
    const oldVersion = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/measurements/${lineOne.id}`,
    })
    expect(oldVersion.json<Measurement>().status).toBe('superseded')
  })
})
