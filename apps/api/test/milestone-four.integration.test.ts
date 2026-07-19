import { createHash, randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import type {
  AdminArea,
  Attachment,
  GpsTrackResponse,
  PresignAttachmentResponse,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { createDatabase, type DatabaseHandle } from '../src/platform/database.js'
import type { ObjectStorageHandle } from '../src/platform/object-storage.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests.')

class FakeStorage implements ObjectStorageHandle {
  current = Buffer.from('field-photo-evidence')
  exists = true
  lastKey = ''
  async check() {
    return true
  }
  async presignPut(objectKey: string) {
    this.lastKey = objectKey
    return `http://example.local/${objectKey}`
  }
  async stat() {
    if (!this.exists) throw new Error('missing')
    return { size: this.current.length, contentType: 'image/jpeg' }
  }
  async getObject() {
    return Readable.from(this.current)
  }
}

let database: DatabaseHandle
let app: Awaited<ReturnType<typeof buildApp>>
const storage = new FakeStorage()

beforeAll(async () => {
  database = createDatabase(databaseUrl)
  app = await buildApp({
    auth: { cookieSecure: false, sessionTtlHours: 1 },
    dependencies: { database, objectStorage: storage },
  })
})
afterAll(async () => {
  await app.close()
  await database.destroy()
})

describe('Milestone 4 field workflow', () => {
  it('keeps raw GPS, filters normalized points and makes sync idempotent', async () => {
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
        caseCode: `M4-${suffix}`,
        name: `Field ${suffix}`,
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
        name: 'GPS field test',
        workTypeId: types.find((item) => item.code === 'LIGHTING_CABLE_LENGTH')!.id,
      },
    })
    const work = workResponse.json<WorkItem>()
    const pointWorkResponse = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/work-items`,
      payload: {
        name: 'GPS point field test',
        workTypeId: types.find((item) => item.measurementKind === 'point')!.id,
      },
    })
    const pointWork = pointWorkResponse.json<WorkItem>()
    const payload = {
      localId: `local-${suffix}`,
      name: 'GPS raw fixture',
      accuracyThresholdM: 30,
      segments: [
        [
          { position: [104.65, 20.8], recordedAt: '2026-07-19T01:00:00.000Z', accuracyM: 5 },
          { position: [104.651, 20.8], recordedAt: '2026-07-19T01:00:10.000Z', accuracyM: 200 },
          { position: [104.652, 20.8], recordedAt: '2026-07-19T01:00:20.000Z', accuracyM: 6 },
        ],
        [
          { position: [104.66, 20.81], recordedAt: '2026-07-19T01:05:00.000Z', accuracyM: 7 },
          { position: [104.661, 20.81], recordedAt: '2026-07-19T01:05:10.000Z', accuracyM: 8 },
        ],
      ],
      note: 'Pause tạo segment mới',
    }
    const syncHeaders = {
      ...headers,
      'idempotency-key': `idem-${suffix}`,
      'x-device-id': `device-${suffix}`,
    }
    const first = await app.inject({
      headers: syncHeaders,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/gps-tracks`,
      payload,
    })
    expect(first.statusCode).toBe(201)
    const gps = first.json<GpsTrackResponse>()
    expect(gps).toMatchObject({
      rawPointCount: 5,
      normalizedPointCount: 4,
      segmentCount: 2,
      idempotentReplay: false,
    })
    expect(gps.measurement.rawGeometry.type).toBe('MultiLineString')
    expect(gps.measurement.normalizedGeometry?.type).toBe('MultiLineString')
    const replay = await app.inject({
      headers: syncHeaders,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/gps-tracks`,
      payload,
    })
    expect(replay.statusCode).toBe(200)
    expect(replay.json<GpsTrackResponse>()).toMatchObject({
      idempotentReplay: true,
      measurement: { id: gps.measurement.id },
    })
    const conflict = await app.inject({
      headers: syncHeaders,
      method: 'POST',
      url: `/api/v1/work-items/${work.id}/gps-tracks`,
      payload: { ...payload, name: 'payload khác' },
    })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json()).toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' })

    const pointHeaders = {
      ...headers,
      'idempotency-key': `point-${suffix}`,
      'x-device-id': `device-${suffix}`,
    }
    const pointPayload = {
      localId: `point-${suffix}`,
      name: 'GPS point fixture',
      point: {
        position: [104.65, 20.8],
        recordedAt: '2026-07-19T01:10:00.000Z',
        accuracyM: 12,
      },
      accuracyThresholdM: 30,
      note: null,
    }
    const gpsPoint = await app.inject({
      headers: pointHeaders,
      method: 'POST',
      url: `/api/v1/work-items/${pointWork.id}/gps-points`,
      payload: pointPayload,
    })
    expect(gpsPoint.statusCode).toBe(201)
    expect(gpsPoint.json()).toMatchObject({
      idempotentReplay: false,
      measurement: {
        method: 'gps_point',
        geometryKind: 'point',
        gpsAccuracyM: 12,
        rawGeometry: { type: 'Point', coordinates: [104.65, 20.8] },
      },
    })
    const gpsPointReplay = await app.inject({
      headers: pointHeaders,
      method: 'POST',
      url: `/api/v1/work-items/${pointWork.id}/gps-points`,
      payload: pointPayload,
    })
    expect(gpsPointReplay.statusCode).toBe(200)
    expect(gpsPointReplay.json()).toMatchObject({ idempotentReplay: true })

    const sha256 = createHash('sha256').update(storage.current).digest('hex')
    const presign = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/attachments/presign',
      payload: {
        measurementId: gps.measurement.id,
        originalName: '../photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: storage.current.length,
        sha256,
      },
    })
    expect(presign.statusCode).toBe(201)
    const pending = presign.json<PresignAttachmentResponse>()
    expect(pending.attachment.uploadStatus).toBe('pending')
    expect(storage.lastKey).not.toContain('..')
    const complete = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/attachments/complete',
      payload: { attachmentId: pending.attachment.id },
    })
    expect(complete.statusCode).toBe(200)
    expect(complete.json<Attachment>()).toMatchObject({ uploadStatus: 'completed', sha256 })
    const completedAttachments = await app.inject({
      headers,
      method: 'GET',
      url: `/api/v1/work-items/${gps.measurement.workItemId}/attachments`,
    })
    expect(completedAttachments.statusCode).toBe(200)
    expect(completedAttachments.json<Attachment[]>()).toEqual([
      expect.objectContaining({ id: pending.attachment.id, uploadStatus: 'completed' }),
    ])

    const tooLarge = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/attachments/presign',
      payload: {
        measurementId: gps.measurement.id,
        originalName: 'large.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 15_000_001,
        sha256,
      },
    })
    expect(tooLarge.statusCode).toBe(400)

    const fakeMime = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/attachments/presign',
      payload: {
        measurementId: gps.measurement.id,
        originalName: 'not-an-image.bin',
        mimeType: 'application/octet-stream',
        sizeBytes: storage.current.length,
        sha256,
      },
    })
    expect(fakeMime.statusCode).toBe(400)

    const wrongHashPresign = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/attachments/presign',
      payload: {
        measurementId: gps.measurement.id,
        originalName: 'wrong-hash.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: storage.current.length,
        sha256: '0'.repeat(64),
      },
    })
    const wrongHash = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/attachments/complete',
      payload: { attachmentId: wrongHashPresign.json<PresignAttachmentResponse>().attachment.id },
    })
    expect(wrongHash.statusCode).toBe(422)
    expect(wrongHash.json()).toMatchObject({ code: 'ATTACHMENT_HASH_MISMATCH' })

    const incompletePresign = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/attachments/presign',
      payload: {
        measurementId: gps.measurement.id,
        originalName: 'pending.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: storage.current.length,
        sha256,
      },
    })
    storage.exists = false
    const incomplete = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/attachments/complete',
      payload: { attachmentId: incompletePresign.json<PresignAttachmentResponse>().attachment.id },
    })
    storage.exists = true
    expect(incomplete.statusCode).toBe(409)
    expect(incomplete.json()).toMatchObject({ code: 'ATTACHMENT_UPLOAD_INCOMPLETE' })

    const lock = await app.inject({
      headers,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/lock`,
      payload: { reason: 'Chốt bằng chứng hiện trường' },
    })
    expect(lock.statusCode).toBe(200)
    const completeAfterLock = await app.inject({
      headers,
      method: 'POST',
      url: '/api/v1/attachments/complete',
      payload: { attachmentId: incompletePresign.json<PresignAttachmentResponse>().attachment.id },
    })
    expect(completeAfterLock.statusCode).toBe(423)
    expect(completeAfterLock.json()).toMatchObject({ code: 'CASE_LOCKED' })
  })
})
