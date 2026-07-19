import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import type {
  AdminArea,
  ExportJob,
  GeoJsonImportCommitResponse,
  GeoJsonImportPreview,
  InspectionCase,
  Measurement,
  MeasurementListResponse,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { createDatabase, type DatabaseHandle } from '../src/platform/database.js'
import type { ObjectStorageHandle } from '../src/platform/object-storage.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests.')

class ArtifactStorage implements ObjectStorageHandle {
  readonly objects = new Map<string, Buffer>()
  async check() {
    return true
  }
  async putObject(key: string, bytes: Buffer) {
    this.objects.set(key, bytes)
  }
  async getObject(key: string) {
    const bytes = this.objects.get(key)
    if (!bytes) throw new Error('missing object')
    return Readable.from(bytes)
  }
}

let database: DatabaseHandle
let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  database = createDatabase(databaseUrl)
  app = await buildApp({
    auth: { cookieSecure: false, sessionTtlHours: 1 },
    dependencies: { database, objectStorage: new ArtifactStorage() },
  })
})

afterAll(async () => {
  await app.close()
  await database.destroy()
})

describe('Phase 2 P1 data workflows', () => {
  it('previews/imports GeoJSON, paginates by cursor/bbox and restores soft deletes', async () => {
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
    const created = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: areas[0]!.id,
        caseCode: `P1-${suffix}`,
        name: `P1 ${suffix}`,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      },
    })
    const inspectionCase = created.json<InspectionCase>()
    const workResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${inspectionCase.id}/work-items`,
      payload: {
        name: 'Tuyến import P1',
        workTypeId: types.find((item) => item.code === 'LIGHTING_CABLE_LENGTH')!.id,
      },
    })
    const work = workResponse.json<WorkItem>()
    const collection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ten: 'Tuyến A', cap: 1 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [104.65, 20.8],
              [104.651, 20.8],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { ten: 'Tuyến B', cap: 2 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [104.66, 20.8],
              [104.661, 20.8],
            ],
          },
        },
      ],
    }
    const previewResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/imports/geojson/preview`,
      payload: { collection, sourceName: 'p1.geojson', nameProperty: 'ten' },
    })
    expect(previewResponse.statusCode).toBe(200)
    const preview = previewResponse.json<GeoJsonImportPreview>()
    expect(preview).toMatchObject({
      featureCount: 2,
      geometryKind: 'line',
      sampleNames: ['Tuyến A', 'Tuyến B'],
    })
    const commitResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/imports/geojson/commit`,
      payload: {
        collection,
        sourceName: 'p1.geojson',
        nameProperty: 'ten',
        expectedHash: preview.sourceHash,
      },
    })
    expect(commitResponse.statusCode).toBe(201)
    const committed = commitResponse.json<GeoJsonImportCommitResponse>()
    expect(committed.measurements).toHaveLength(2)
    expect(committed.measurements.every((item) => item.method === 'import_geojson')).toBe(true)

    const firstPageResponse = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/work-items/${work.id}/measurements?limit=1`,
    })
    const firstPage = firstPageResponse.json<MeasurementListResponse>()
    expect(firstPage.items).toHaveLength(1)
    expect(firstPage.nextCursor).toBeTruthy()
    const secondPage = (
      await app.inject({
        headers: { cookie },
        method: 'GET',
        url: `/api/v1/work-items/${work.id}/measurements?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
      })
    ).json<MeasurementListResponse>()
    expect(secondPage.items[0]!.id).not.toBe(firstPage.items[0]!.id)
    const bboxPage = (
      await app.inject({
        headers: { cookie },
        method: 'GET',
        url: `/api/v1/work-items/${work.id}/measurements?bbox=104.649,20.799,104.652,20.801`,
      })
    ).json<MeasurementListResponse>()
    expect(bboxPage.items.map((item) => item.name)).toEqual(['Tuyến A'])

    const removedMeasurement = await app.inject({
      headers,
      method: 'DELETE',
      url: `/api/v1/measurements/${committed.measurements[0]!.id}`,
    })
    expect(removedMeasurement.statusCode).toBe(204)
    const deleted = (
      await app.inject({
        headers: { cookie },
        method: 'GET',
        url: `/api/v1/work-items/${work.id}/measurements/deleted`,
      })
    ).json<Measurement[]>()
    expect(deleted.map((item) => item.id)).toContain(committed.measurements[0]!.id)
    const restored = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/measurements/${committed.measurements[0]!.id}/restore`,
      payload: { reason: 'Phục hồi phép đo P1' },
    })
    expect(restored.statusCode).toBe(200)

    const removedCase = await app.inject({
      headers,
      method: 'DELETE',
      url: `/api/v1/cases/${inspectionCase.id}`,
    })
    expect(removedCase.statusCode).toBe(204)
    const restoredCase = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${inspectionCase.id}/restore`,
      payload: { reason: 'Phục hồi hồ sơ P1' },
    })
    expect(restoredCase.statusCode).toBe(200)
  })

  it('queues a locked export, stores it and streams an authorized download', async () => {
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
    const created = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: area.id,
        caseCode: `P1-EXPORT-${suffix}`,
        name: `Export P1 ${suffix}`,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      },
    })
    const caseId = created.json<InspectionCase>().id
    await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/lock`,
      payload: { reason: 'Khóa để kiểm thử queue' },
    })
    const queuedResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/export-jobs/geojson`,
      payload: {},
    })
    expect(queuedResponse.statusCode).toBe(202)
    let job = queuedResponse.json<ExportJob>()
    for (let attempt = 0; attempt < 100 && job.status !== 'completed'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10))
      job = (
        await app.inject({ headers: { cookie }, method: 'GET', url: `/api/v1/exports/${job.id}` })
      ).json<ExportJob>()
    }
    expect(job).toMatchObject({ status: 'completed', format: 'geojson' })
    const download = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/exports/${job.id}/download`,
    })
    expect(download.statusCode).toBe(200)
    expect(download.headers['x-file-sha256']).toBe(job.fileHash)
    expect(JSON.parse(download.body)).toMatchObject({ type: 'FeatureCollection' })
  })
})
