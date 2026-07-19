import { randomUUID } from 'node:crypto'

import type { AdminArea, AuditEvent, InspectionCase, WorkItem, WorkType } from '@dove/contracts'
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

describe('Phase 2 case structure copy', () => {
  it('copies only selected work-item snapshots and leaves evidence data behind', async () => {
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
    const workTypes = (
      await app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/catalog/work-types' })
    ).json<WorkType[]>()
    const suffix = randomUUID().slice(0, 8)

    const sourceResponse = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: areas[0]!.id,
        caseCode: `COPY-SOURCE-${suffix}`,
        name: `Hồ sơ mẫu ${suffix}`,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
      },
    })
    expect(sourceResponse.statusCode).toBe(201)
    const sourceCase = sourceResponse.json<InspectionCase>()

    const selectedType = workTypes.find((item) => item.code === 'LIGHTING_CABLE_LENGTH')!
    const otherType = workTypes.find((item) => item.id !== selectedType.id)!
    const createSourceWorkItem = async (workType: WorkType, index: number) => {
      const response = await app.inject({
        headers,
        method: 'POST',
        url: `/api/v1/cases/${sourceCase.id}/work-items`,
        payload: {
          name: `Công tác mẫu ${index + 1}`,
          periodStart: '2026-06-01',
          periodEnd: '2026-06-30',
          warningThreshold: { percent: 5 + index },
          workTypeId: workType.id,
        },
      })
      expect(response.statusCode).toBe(201)
      return response.json<WorkItem>()
    }
    const selectedSource = await createSourceWorkItem(selectedType, 0)
    await createSourceWorkItem(otherType, 1)

    const measurement = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/work-items/${selectedSource.id}/measurements`,
      payload: {
        name: 'Kết quả chỉ thuộc hồ sơ nguồn',
        geometry: {
          type: 'LineString',
          coordinates: [
            [104.65, 20.8],
            [104.651, 20.8],
          ],
        },
        geometryKind: 'line',
      },
    })
    expect(measurement.statusCode).toBe(201)

    const targetResponse = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: areas[0]!.id,
        caseCode: `COPY-TARGET-${suffix}`,
        name: `Hồ sơ đích ${suffix}`,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        copyStructure: {
          sourceCaseId: sourceCase.id,
          workItemIds: [selectedSource.id],
        },
      },
    })
    expect(targetResponse.statusCode).toBe(201)
    const targetCase = targetResponse.json<InspectionCase>()
    expect(targetCase.workItemCount).toBe(1)

    const copiedItemsResponse = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${targetCase.id}/work-items`,
    })
    expect(copiedItemsResponse.statusCode).toBe(200)
    const copiedItems = copiedItemsResponse.json<WorkItem[]>()
    expect(copiedItems).toHaveLength(1)
    expect(copiedItems[0]).toMatchObject({
      formulaSnapshot: selectedSource.formulaSnapshot,
      name: selectedSource.name,
      periodEnd: null,
      periodStart: null,
      status: 'draft',
      unit: selectedSource.unit,
      warningThreshold: selectedSource.warningThreshold,
      workTypeId: selectedSource.workTypeId,
    })

    const copiedMeasurements = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/work-items/${copiedItems[0]!.id}/measurements`,
    })
    expect(copiedMeasurements.statusCode).toBe(200)
    expect(copiedMeasurements.json<{ items: unknown[] }>().items).toHaveLength(0)

    const audit = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${targetCase.id}/audit-events`,
    })
    expect(audit.statusCode).toBe(200)
    expect(audit.json<AuditEvent[]>().map((event) => event.action)).toEqual(
      expect.arrayContaining(['created', 'structure_copied']),
    )
  })

  it('rolls the target case back when a selected work item is outside the source case', async () => {
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
    const area = (
      await app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/admin-areas' })
    ).json<AdminArea[]>()[0]!
    const suffix = randomUUID().slice(0, 8)
    const source = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: area.id,
        caseCode: `COPY-INVALID-SOURCE-${suffix}`,
        name: 'Nguồn kiểm tra rollback',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      },
    })
    const targetCode = `COPY-INVALID-TARGET-${suffix}`
    const rejected = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: area.id,
        caseCode: targetCode,
        name: 'Đích phải rollback',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        copyStructure: {
          sourceCaseId: source.json<InspectionCase>().id,
          workItemIds: [randomUUID()],
        },
      },
    })
    expect(rejected.statusCode).toBe(422)
    expect(rejected.json()).toMatchObject({ code: 'SOURCE_WORK_ITEMS_INVALID' })

    const listed = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases?search=${targetCode}`,
    })
    expect(listed.json<{ items: InspectionCase[] }>().items).toHaveLength(0)
  })
})
