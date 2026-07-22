import { randomUUID } from 'node:crypto'

import type {
  AdminArea,
  ManagementZone,
  ServiceGroup,
  WorkComponent,
  WorkItem,
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
  await sql`UPDATE case_work_item SET management_zone_id=NULL WHERE management_zone_id IN (
    SELECT id FROM management_zone WHERE code LIKE 'TEST_%'
  )`.execute(database.query)
  await sql`DELETE FROM management_zone WHERE code LIKE 'TEST_%'`.execute(database.query)
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
  await sql`UPDATE case_work_item SET management_zone_id=NULL WHERE inspection_case_id IN (
    SELECT id FROM inspection_case WHERE case_code LIKE 'STRUCT-%'
  )`.execute(database.query)
  await sql`UPDATE case_work_item SET management_zone_id=NULL WHERE management_zone_id IN (
    SELECT id FROM management_zone WHERE code LIKE 'TEST_%'
  )`.execute(database.query)
  await sql`DELETE FROM management_zone WHERE code LIKE 'TEST_%'`.execute(database.query)
  await app.close()
  await database.destroy()
})

describe('Map-first editable structure API', () => {
  it('exposes 12 name-only management zones and supports versioned lifecycle', async () => {
    const list = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: '/api/v1/catalog/management-zones',
    })
    expect(list.statusCode).toBe(200)
    const zones = list.json<ManagementZone[]>()
    expect(zones).toHaveLength(12)
    expect(zones.map((zone) => zone.name)).toEqual(
      expect.arrayContaining(['Thành phố Sơn La', 'Vân Hồ']),
    )
    expect(zones.every((zone) => !Object.hasOwn(zone, 'geometry'))).toBe(true)

    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
    const createdResponse = await app.inject({
      headers: mutationHeaders,
      method: 'POST',
      url: '/api/v1/catalog/management-zones',
      payload: { code: `TEST_${suffix}`, displayOrder: 999, name: 'Khu vực thử' },
    })
    expect(createdResponse.statusCode).toBe(201)
    const created = createdResponse.json<ManagementZone>()

    const updatedResponse = await app.inject({
      headers: { ...mutationHeaders, 'if-match': `"${created.version}"` },
      method: 'PATCH',
      url: `/api/v1/catalog/management-zones/${created.id}`,
      payload: { name: 'Khu vực đã đổi tên' },
    })
    expect(updatedResponse.statusCode).toBe(200)
    const updated = updatedResponse.json<ManagementZone>()
    expect(updated).toMatchObject({ id: created.id, name: 'Khu vực đã đổi tên', version: 2 })

    const stale = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"1"' },
      method: 'PATCH',
      url: `/api/v1/catalog/management-zones/${created.id}`,
      payload: { name: 'Ghi đè lỗi' },
    })
    expect(stale.statusCode).toBe(409)

    const removed = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"2"' },
      method: 'DELETE',
      url: `/api/v1/catalog/management-zones/${created.id}`,
      payload: { reason: 'Dọn dữ liệu kiểm thử' },
    })
    const removedZone = removed.json<ManagementZone>()
    expect(removedZone).toMatchObject({ active: false, version: 3 })
    expect(typeof removedZone.deletedAt).toBe('string')
    const restored = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"3"' },
      method: 'POST',
      url: `/api/v1/catalog/management-zones/${created.id}/restore`,
      payload: { reason: 'Khôi phục kiểm thử' },
    })
    expect(restored.json<ManagementZone>()).toMatchObject({
      active: true,
      deletedAt: null,
      version: 4,
    })

    const groupResponse = await app.inject({
      headers: mutationHeaders,
      method: 'POST',
      url: '/api/v1/catalog/service-groups',
      payload: { code: `GROUP_${suffix}`, displayOrder: 999, name: 'Lĩnh vực thử' },
    })
    expect(groupResponse.statusCode).toBe(201)
    const group = groupResponse.json<ServiceGroup>()
    const groupUpdate = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"1"' },
      method: 'PATCH',
      url: `/api/v1/catalog/service-groups/${group.id}`,
      payload: { name: 'Lĩnh vực đã đổi tên' },
    })
    expect(groupUpdate.json<ServiceGroup>()).toMatchObject({ id: group.id, version: 2 })
    const groupDelete = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"2"' },
      method: 'DELETE',
      url: `/api/v1/catalog/service-groups/${group.id}`,
      payload: { reason: 'Lưu trữ lĩnh vực thử' },
    })
    expect(groupDelete.json<ServiceGroup>()).toMatchObject({ active: false, version: 3 })
    const groupRestore = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"3"' },
      method: 'POST',
      url: `/api/v1/catalog/service-groups/${group.id}/restore`,
      payload: { reason: 'Khôi phục lĩnh vực thử' },
    })
    expect(groupRestore.json<ServiceGroup>()).toMatchObject({ active: true, version: 4 })
    const finalDelete = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"4"' },
      method: 'DELETE',
      url: `/api/v1/catalog/service-groups/${group.id}`,
      payload: { reason: 'Kết thúc kiểm thử lĩnh vực' },
    })
    expect(finalDelete.json<ServiceGroup>()).toMatchObject({ active: false, version: 5 })
  })

  it('renames work items and manages independently versioned child items', async () => {
    const [areasResponse, typesResponse, zonesResponse] = await Promise.all([
      app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/admin-areas' }),
      app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/catalog/work-types' }),
      app.inject({ headers: { cookie }, method: 'GET', url: '/api/v1/catalog/management-zones' }),
    ])
    const area = areasResponse.json<AdminArea[]>()[0]!
    const types = typesResponse.json<WorkType[]>()
    const type = types.find((item) => item.measurementKind === 'line')!
    const compatibleType = types.find(
      (item) => item.measurementKind === 'line' && item.id !== type.id,
    )!
    const incompatibleType = types.find((item) => item.measurementKind === 'point')!
    const zone = zonesResponse.json<ManagementZone[]>()[0]!
    const suffix = randomUUID().slice(0, 8)
    const caseResponse = await app.inject({
      headers: mutationHeaders,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: area.id,
        caseCode: `STRUCT-${suffix}`,
        name: 'Hồ sơ cấu trúc',
        periodEnd: '2026-07-31',
        periodStart: '2026-07-01',
      },
    })
    const caseId = caseResponse.json<{ id: string }>().id
    const itemResponse = await app.inject({
      headers: mutationHeaders,
      method: 'POST',
      url: `/api/v1/cases/${caseId}/work-items`,
      payload: { managementZoneId: zone.id, name: 'Chiều dài đường', workTypeId: type.id },
    })
    expect(itemResponse.statusCode).toBe(201)
    const item = itemResponse.json<WorkItem>()
    expect(item).toMatchObject({
      managementZoneId: zone.id,
      managementZoneName: zone.name,
      version: 1,
    })

    const otherEmail = `structure-${suffix}@example.local`
    await sql`INSERT INTO app_user (email, display_name, password_hash, role)
      SELECT ${otherEmail}, 'Người dùng IDOR', password_hash, 'owner'
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
    const otherCsrf = otherLogin.cookies.find((entry) => entry.name === 'dove_csrf')!
    const idor = await app.inject({
      headers: {
        cookie: `dove_session=${otherSession.value}; dove_csrf=${otherCsrf.value}`,
        'if-match': '"1"',
        'x-csrf-token': otherCsrf.value,
      },
      method: 'PATCH',
      url: `/api/v1/work-items/${item.id}`,
      payload: { name: 'Không được phép' },
    })
    expect(idor.statusCode).toBe(404)

    const reclassifiedResponse = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"1"' },
      method: 'PATCH',
      url: `/api/v1/work-items/${item.id}`,
      payload: { workTypeId: compatibleType.id },
    })
    expect(reclassifiedResponse.statusCode).toBe(200)
    expect(reclassifiedResponse.json<WorkItem>()).toMatchObject({
      serviceGroupId: compatibleType.serviceGroupId,
      unit: compatibleType.baseUnit,
      version: 2,
      workTypeCode: compatibleType.code,
      workTypeId: compatibleType.id,
    })

    const incompatibleResponse = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"2"' },
      method: 'PATCH',
      url: `/api/v1/work-items/${item.id}`,
      payload: { workTypeId: incompatibleType.id },
    })
    expect(incompatibleResponse.statusCode).toBe(422)
    expect(incompatibleResponse.json<{ code: string }>()).toMatchObject({
      code: 'WORK_TYPE_INCOMPATIBLE',
    })

    const renamedResponse = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"2"' },
      method: 'PATCH',
      url: `/api/v1/work-items/${item.id}`,
      payload: { name: 'Chiều dài đường đã rà soát' },
    })
    expect(renamedResponse.json<WorkItem>()).toMatchObject({
      id: item.id,
      name: 'Chiều dài đường đã rà soát',
      version: 3,
    })

    const componentResponse = await app.inject({
      headers: mutationHeaders,
      method: 'POST',
      url: `/api/v1/work-items/${item.id}/components`,
      payload: { displayOrder: 10, name: 'Đường Nguyễn Trãi' },
    })
    expect(componentResponse.statusCode).toBe(201)
    const component = componentResponse.json<WorkComponent>()
    const componentUpdate = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"1"' },
      method: 'PATCH',
      url: `/api/v1/work-components/${component.id}`,
      payload: { name: 'Đường Nguyễn Trãi A' },
    })
    expect(componentUpdate.json<WorkComponent>()).toMatchObject({ id: component.id, version: 2 })

    const blockedParentDelete = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"3"' },
      method: 'DELETE',
      url: `/api/v1/work-items/${item.id}`,
      payload: { reason: 'Kiểm tra chặn dữ liệu con' },
    })
    expect(blockedParentDelete.statusCode).toBe(409)

    const removedComponent = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"2"' },
      method: 'DELETE',
      url: `/api/v1/work-components/${component.id}`,
      payload: { reason: 'Lưu trữ mục con thử' },
    })
    const deletedComponent = removedComponent.json<WorkComponent>()
    expect(deletedComponent.version).toBe(3)
    expect(typeof deletedComponent.deletedAt).toBe('string')
    const removedItem = await app.inject({
      headers: { ...mutationHeaders, 'if-match': '"3"' },
      method: 'DELETE',
      url: `/api/v1/work-items/${item.id}`,
      payload: { reason: 'Lưu trữ công tác thử' },
    })
    const deletedItem = removedItem.json<WorkItem>()
    expect(deletedItem.version).toBe(4)
    expect(typeof deletedItem.deletedAt).toBe('string')
  })
})
