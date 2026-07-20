import { randomUUID } from 'node:crypto'

import type {
  AdminArea,
  CaptureDraft,
  CaptureDraftMutationResponse,
  ClassifyCaptureDraftResponse,
  ManagementZone,
  MeasurementListResponse,
  WorkComponent,
  WorkType,
} from '@dove/contracts'
import { sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { createDatabase, type DatabaseHandle } from '../src/platform/database.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests.')

let database: DatabaseHandle
let app: Awaited<ReturnType<typeof buildApp>>
let cookie = ''
let mutationHeaders: Record<string, string>

beforeAll(async () => {
  database = createDatabase(databaseUrl)
  app = await buildApp({
    auth: { cookieSecure: false, sessionTtlHours: 1 },
    dependencies: { database, objectStorage: { check: async () => true } },
  })
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
  cookie = `dove_session=${session.value}; dove_csrf=${csrf.value}`
  mutationHeaders = { cookie, 'x-csrf-token': csrf.value }
})

afterAll(async () => {
  await sql`UPDATE capture_draft SET
    classification_idempotency_key='legacy:' || id::text,
    classification_payload_hash=encode(digest('legacy:' || id::text,'sha256'),'hex')
    WHERE inspection_case_id IN (
      SELECT id FROM inspection_case WHERE case_code LIKE 'CAP4-%'
    ) AND classification_idempotency_key IS NOT NULL`.execute(database.query)
  await app.close()
  await database.destroy()
})

async function catalogs() {
  const [areasResponse, typesResponse, zonesResponse] = await Promise.all([
    app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/admin-areas' }),
    app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/catalog/work-types' }),
    app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/catalog/management-zones' }),
  ])
  return {
    area: areasResponse.json<AdminArea[]>()[0]!,
    types: typesResponse.json<WorkType[]>(),
    zone: zonesResponse.json<ManagementZone[]>()[0]!,
  }
}

async function createCase(code: string) {
  const { area } = await catalogs()
  const response = await app.inject({
    headers: mutationHeaders,
    method: 'POST',
    url: '/api/v1/cases',
    payload: {
      adminAreaId: area.id,
      caseCode: code,
      name: `Hồ sơ ${code}`,
      periodEnd: '2026-07-31',
      periodStart: '2026-07-01',
    },
  })
  expect(response.statusCode).toBe(201)
  return response.json<{ id: string }>().id
}

describe('Capture draft API', () => {
  it('stores, replays, edits and classifies a draft atomically without duplicate measurements', async () => {
    const suffix = randomUUID().slice(0, 8)
    const deviceId = `device-${suffix}`
    const caseId = await createCase(`CAP4-MAIN-${suffix}`)
    const { types, zone } = await catalogs()
    const lineType = types.find((item) => item.measurementKind === 'line')!
    const geometry = {
      coordinates: [
        [104.65, 20.8],
        [104.651, 20.8],
      ],
      type: 'LineString' as const,
    }
    const createPayload = {
      geometry,
      geometryKind: 'line',
      localId: `local-${suffix}`,
      metadata: { source: 'map-toolbar' },
    }
    const createHeaders = {
      ...mutationHeaders,
      'idempotency-key': `create-${suffix}`,
      'x-device-id': deviceId,
    }
    const createdResponse = await app.inject({
      headers: createHeaders,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/capture-drafts`,
      payload: createPayload,
    })
    expect(createdResponse.statusCode).toBe(201)
    const created = createdResponse.json<CaptureDraftMutationResponse>()
    expect(created).toMatchObject({
      idempotentReplay: false,
      draft: { caseId, classifiedMeasurementId: null, status: 'unclassified', version: 1 },
    })

    const otherEmail = `capture-${suffix}@example.local`
    await sql`INSERT INTO app_user (email, display_name, password_hash, role)
      SELECT ${otherEmail}, 'Người dùng IDOR nháp', password_hash, 'owner'
      FROM app_user WHERE email=${process.env.BOOTSTRAP_OWNER_EMAIL} LIMIT 1`.execute(
      database.query,
    )
    const otherLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: otherEmail,
        password: process.env.BOOTSTRAP_OWNER_PASSWORD,
      },
    })
    const otherSession = otherLogin.cookies.find((entry) => entry.name === 'dove_session')!
    const idor = await app.inject({
      headers: { cookie: `dove_session=${otherSession.value}` },
      method: 'GET',
      url: `/api/v1/capture-drafts/${created.draft.id}`,
    })
    expect(idor.statusCode).toBe(404)
    const draftList = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/capture-drafts`,
    })
    expect(draftList.json<CaptureDraft[]>().map((item) => item.id)).toContain(created.draft.id)

    const replay = await app.inject({
      headers: createHeaders,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/capture-drafts`,
      payload: createPayload,
    })
    expect(replay.statusCode).toBe(200)
    expect(replay.json<CaptureDraftMutationResponse>()).toMatchObject({
      idempotentReplay: true,
      draft: { id: created.draft.id },
    })
    const conflictingCreate = await app.inject({
      headers: createHeaders,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/capture-drafts`,
      payload: { ...createPayload, metadata: { source: 'changed' } },
    })
    expect(conflictingCreate.statusCode).toBe(409)

    const invalid = await app.inject({
      headers: {
        ...mutationHeaders,
        'idempotency-key': `invalid-${suffix}`,
        'x-device-id': deviceId,
      },
      method: 'POST',
      url: `/api/v1/cases/${caseId}/capture-drafts`,
      payload: {
        geometry: { coordinates: [[104.65, 20.8]], type: 'LineString' },
        geometryKind: 'line',
        localId: `invalid-${suffix}`,
      },
    })
    expect(invalid.statusCode).toBe(422)

    const updatedResponse = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"1"' },
      method: 'PATCH',
      url: `/api/v1/capture-drafts/${created.draft.id}`,
      payload: { metadata: { source: 'map-toolbar', reviewed: true } },
    })
    expect(updatedResponse.json<CaptureDraft>()).toMatchObject({ id: created.draft.id, version: 2 })
    const staleUpdate = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"1"' },
      method: 'PATCH',
      url: `/api/v1/capture-drafts/${created.draft.id}`,
      payload: { metadata: {} },
    })
    expect(staleUpdate.statusCode).toBe(409)

    const classifyPayload = {
      calculationInputs: {},
      createWorkComponent: { displayOrder: 10, name: 'Đường thử nghiệm' },
      createWorkItem: {
        managementZoneId: zone.id,
        name: 'Chiều dài đường',
        workTypeId: lineType.id,
      },
      measurementName: 'Đoạn 01',
    }
    const classifyHeaders = {
      ...mutationHeaders,
      'idempotency-key': `classify-${suffix}`,
      'if-match': '"2"',
      'x-device-id': deviceId,
    }
    const classifiedResponse = await app.inject({
      headers: classifyHeaders,
      method: 'POST',
      url: `/api/v1/capture-drafts/${created.draft.id}/classify`,
      payload: classifyPayload,
    })
    expect(classifiedResponse.statusCode).toBe(201)
    const classified = classifiedResponse.json<ClassifyCaptureDraftResponse>()
    expect(classified).toMatchObject({
      idempotentReplay: false,
      draft: { id: created.draft.id, status: 'classified', version: 3 },
      measurement: { captureDraftId: created.draft.id, geometryKind: 'line' },
    })
    expect(classified.measurement.workComponentId).not.toBeNull()
    expect(classified.measurement.baseValue).toBeGreaterThan(100)

    const replayClassification = await app.inject({
      headers: classifyHeaders,
      method: 'POST',
      url: `/api/v1/capture-drafts/${created.draft.id}/classify`,
      payload: classifyPayload,
    })
    expect(replayClassification.statusCode).toBe(200)
    expect(replayClassification.json<ClassifyCaptureDraftResponse>()).toMatchObject({
      idempotentReplay: true,
      measurement: { id: classified.measurement.id },
    })
    const conflictingClassification = await app.inject({
      headers: classifyHeaders,
      method: 'POST',
      url: `/api/v1/capture-drafts/${created.draft.id}/classify`,
      payload: { ...classifyPayload, measurementName: 'Đoạn khác' },
    })
    expect(conflictingClassification.statusCode).toBe(409)

    const measurementList = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/work-items/${classified.measurement.workItemId}/measurements`,
    })
    const summary = measurementList.json<MeasurementListResponse>()
    expect(summary.items.filter((item) => item.captureDraftId === created.draft.id)).toHaveLength(1)
    expect(summary.confirmedTotal).toBe(0)
    const components = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/work-items/${classified.measurement.workItemId}/components`,
    })
    expect(components.json<WorkComponent[]>()).toHaveLength(1)
    const archivedClassifiedDraft = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"3"' },
      method: 'DELETE',
      url: `/api/v1/capture-drafts/${created.draft.id}`,
      payload: { reason: 'Lưu trữ raw nháp sau phân loại' },
    })
    expect(archivedClassifiedDraft.json<CaptureDraft>()).toMatchObject({
      status: 'deleted',
      version: 4,
    })
    const revalidatedMeasurement = await app.inject({
      headers: mutationHeaders,
      method: 'POST',
      url: `/api/v1/measurements/${classified.measurement.id}/validate`,
    })
    expect(revalidatedMeasurement.statusCode).toBe(200)
    const audit = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/audit-events`,
    })
    expect(audit.json<Array<{ action: string }>>().map((event) => event.action)).toEqual(
      expect.arrayContaining(['created', 'classified', 'created_from_capture']),
    )
  })

  it('archives/restores drafts and rejects sync/classification after the case is locked', async () => {
    const suffix = randomUUID().slice(0, 8)
    const deviceId = `device-lock-${suffix}`
    const caseId = await createCase(`CAP4-LOCK-${suffix}`)
    const payload = {
      geometry: { coordinates: [104.65, 20.8], type: 'Point' },
      geometryKind: 'point',
      localId: `lock-${suffix}`,
    }
    const createdResponse = await app.inject({
      headers: {
        ...mutationHeaders,
        'idempotency-key': `lock-create-${suffix}`,
        'x-device-id': deviceId,
      },
      method: 'POST',
      url: `/api/v1/cases/${caseId}/capture-drafts`,
      payload,
    })
    const draft = createdResponse.json<CaptureDraftMutationResponse>().draft

    const removed = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"1"' },
      method: 'DELETE',
      url: `/api/v1/capture-drafts/${draft.id}`,
      payload: { reason: 'Kiểm tra lưu trữ nháp' },
    })
    expect(removed.json<CaptureDraft>()).toMatchObject({ status: 'deleted', version: 2 })
    const restored = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"2"' },
      method: 'POST',
      url: `/api/v1/capture-drafts/${draft.id}/restore`,
      payload: { reason: 'Khôi phục nháp' },
    })
    expect(restored.json<CaptureDraft>()).toMatchObject({ status: 'unclassified', version: 3 })

    const locked = await app.inject({
      headers: mutationHeaders,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/lock`,
      payload: { reason: 'Khóa để kiểm tra Task 4' },
    })
    expect(locked.statusCode).toBe(200)
    const { types } = await catalogs()
    const pointType = types.find((item) => item.measurementKind === 'point')!
    const classify = await app.inject({
      headers: {
        ...mutationHeaders,
        'idempotency-key': `locked-classify-${suffix}`,
        'if-match': '"3"',
        'x-device-id': deviceId,
      },
      method: 'POST',
      url: `/api/v1/capture-drafts/${draft.id}/classify`,
      payload: {
        createWorkItem: { name: 'Điểm khóa', workTypeId: pointType.id },
        measurementName: 'Điểm 01',
      },
    })
    expect(classify.statusCode).toBe(423)
    const unchanged = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/capture-drafts/${draft.id}`,
    })
    expect(unchanged.json<CaptureDraft>()).toMatchObject({ status: 'unclassified', version: 3 })
    const count = await sql<{ count: number }>`SELECT count(*)::integer AS count FROM measurement
      WHERE capture_draft_id=${draft.id}::uuid`.execute(database.query)
    expect(count.rows[0]?.count).toBe(0)

    const createAfterLock = await app.inject({
      headers: {
        ...mutationHeaders,
        'idempotency-key': `after-lock-${suffix}`,
        'x-device-id': deviceId,
      },
      method: 'POST',
      url: `/api/v1/cases/${caseId}/capture-drafts`,
      payload: { ...payload, localId: `after-${suffix}` },
    })
    expect(createAfterLock.statusCode).toBe(423)
  })
})
