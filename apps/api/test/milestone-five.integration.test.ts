import { createHash, randomUUID } from 'node:crypto'

import type {
  AdminArea,
  CaseComparison,
  CaseTransitionResponse,
  Measurement,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import ExcelJS from 'exceljs'
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

describe('Milestone 5 comparison, snapshot and exports', () => {
  it('compares official totals, locks mutations and exports traceable XLSX/GeoJSON', async () => {
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
    const suffix = randomUUID().slice(0, 8)
    const createdCase = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: areas[0]!.id,
        caseCode: `M5-${suffix}`,
        name: `Comparison ${suffix}`,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      },
    })
    const caseId = createdCase.json<{ id: string }>().id
    const workResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/work-items`,
      payload: {
        name: 'Cáp chiếu sáng đối chiếu',
        workTypeId: types.find((item) => item.code === 'LIGHTING_CABLE_LENGTH')!.id,
      },
    })
    const work = workResponse.json<WorkItem>()
    const measurementResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/measurements`,
      payload: {
        name: 'Tuyến M5',
        geometryKind: 'line',
        geometry: {
          type: 'LineString',
          coordinates: [
            [104.65, 20.8],
            [104.65961, 20.8],
          ],
        },
      },
    })
    const measurement = measurementResponse.json<Measurement>()
    const confirmedResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/measurements/${measurement.id}/confirm`,
      payload: {},
    })
    expect(confirmedResponse.statusCode).toBe(200)
    const inspected = confirmedResponse.json<Measurement>().calculatedQuantity!
    await app.inject({
      headers,
      method: 'PATCH',
      url: `/api/v1/cases/${caseId}/comparison-settings`,
      payload: { percent: 0.5 },
    })
    const sourceResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/source-quantities`,
      payload: {
        sourceKind: 'accepted',
        quantity: inspected + 10,
        unit: work.unit,
        documentNo: 'NT-M5',
      },
    })
    expect(sourceResponse.statusCode).toBe(201)
    const sourceId = sourceResponse.json<{ id: string }>().id
    const explanation = await app.inject({
      headers,
      method: 'PUT',
      url: `/api/v1/source-quantities/${sourceId}/explanation`,
      payload: { explanation: 'Sai khác do phạm vi nghiệm thu rộng hơn.' },
    })
    expect(explanation.statusCode).toBe(200)
    const comparisonResponse = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/comparison`,
    })
    const comparison = comparisonResponse.json<CaseComparison>()
    expect(comparison.items[0]).toMatchObject({
      sourceQuantityId: sourceId,
      inspectedQuantity: inspected,
      difference: -10,
      status: 'warning',
      explanation: 'Sai khác do phạm vi nghiệm thu rộng hơn.',
    })
    expect(comparison.aggregates.some((item) => item.groupId === null)).toBe(true)

    const unlockedExport = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/exports/excel`,
    })
    expect(unlockedExport.statusCode).toBe(409)
    expect(unlockedExport.json()).toMatchObject({ code: 'CASE_MUST_BE_LOCKED_FOR_EXPORT' })

    const locked = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/lock`,
      payload: { reason: 'Chốt hồ sơ để xuất M5' },
    })
    expect(locked.statusCode).toBe(200)
    const lockResult = locked.json<CaseTransitionResponse>()
    expect(lockResult).toMatchObject({
      inspectionCase: { status: 'locked' },
    })
    expect(lockResult.snapshot?.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
    const rejected = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/source-quantities`,
      payload: { sourceKind: 'contract', quantity: inspected, unit: work.unit },
    })
    expect(rejected.statusCode).toBeGreaterThanOrEqual(400)

    const excel = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/exports/excel`,
    })
    expect(excel.statusCode).toBe(200)
    expect(excel.headers['x-file-sha256']).toBe(
      createHash('sha256').update(excel.rawPayload).digest('hex'),
    )
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Uint8Array.from(excel.rawPayload).buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Hồ sơ',
      'Công tác',
      'Phép đo',
      'Khối lượng nguồn',
      'Đối chiếu',
    ])

    const geoJson = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/exports/geojson`,
    })
    const collection = JSON.parse(geoJson.body) as {
      features: Array<{ properties: { measurementId: string; workItemId: string } }>
    }
    expect(collection.features[0]!.properties).toMatchObject({
      measurementId: measurement.id,
      workItemId: work.id,
    })

    const unlocked = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/unlock`,
      payload: { reason: 'Mở khóa để hiệu chỉnh có kiểm soát' },
    })
    expect(unlocked.json()).toMatchObject({ inspectionCase: { status: 'in_progress' } })
    const audit = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/audit-events`,
    })
    const actions = audit.json<Array<{ action: string }>>().map((item) => item.action)
    expect(actions).toEqual(expect.arrayContaining(['locked', 'unlocked', 'exported', 'explained']))
  })
})
