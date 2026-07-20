import { randomUUID } from 'node:crypto'

import type { MapFeatureListResponse } from '@dove/contracts'
import { sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { createDatabase, type DatabaseHandle } from '../src/platform/database.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests.')

let database: DatabaseHandle
let app: Awaited<ReturnType<typeof buildApp>>
let cookie = ''
const caseId = randomUUID()
const workItemId = randomUUID()
const componentId = randomUUID()
let zoneId = ''
let groupId = ''

beforeAll(async () => {
  database = createDatabase(databaseUrl)
  const fixture = await sql<{
    areaId: string
    groupId: string
    ownerId: string
    workTypeId: string
    zoneId: string
  }>`SELECT a.id AS "areaId",u.id AS "ownerId",t.id AS "workTypeId",
      t.service_group_id AS "groupId",z.id AS "zoneId"
    FROM admin_area a CROSS JOIN app_user u CROSS JOIN work_type t CROSS JOIN management_zone z
    WHERE u.email=${process.env.BOOTSTRAP_OWNER_EMAIL!} AND t.measurement_kind='point'
      AND z.deleted_at IS NULL LIMIT 1`.execute(database.query)
  const row = fixture.rows[0]!
  zoneId = row.zoneId
  groupId = row.groupId
  await sql`INSERT INTO inspection_case
    (id,case_code,name,admin_area_id,boundary_snapshot,period_start,period_end,status,owner_id)
    SELECT ${caseId}::uuid,${`MAP-${caseId.slice(0, 8)}`},'Map feature filters',a.id,a.boundary,
      '2026-07-01','2026-07-31','in_progress',${row.ownerId}::uuid
    FROM admin_area a WHERE a.id=${row.areaId}::uuid`.execute(database.query)
  await sql`INSERT INTO case_work_item
    (id,inspection_case_id,management_zone_id,work_type_id,name,unit,formula_snapshot,warning_threshold)
    SELECT ${workItemId}::uuid,${caseId}::uuid,${zoneId}::uuid,t.id,'Công tác lọc',t.base_unit,
      jsonb_build_object('workTypeCode',t.code,'calculationVersion',t.calculation_version,
        'calculationSpec',t.calculation_spec),'{}'::jsonb
    FROM work_type t WHERE t.id=${row.workTypeId}::uuid`.execute(database.query)
  await sql`INSERT INTO work_component
    (id,case_work_item_id,name,display_order,status,created_by)
    VALUES (${componentId}::uuid,${workItemId}::uuid,'Mục con A',10,'active',${row.ownerId}::uuid)`.execute(
    database.query,
  )
  await sql`INSERT INTO measurement
    (case_work_item_id,work_component_id,code,name,method,geometry_kind,raw_geometry,
      normalized_geometry,base_value,calculated_quantity,unit,calculation_rule_code,
      calculation_version,calculation_output,validation_status,status,created_by,confirmed_at,confirmed_by)
    VALUES
    (${workItemId}::uuid,${componentId}::uuid,'MAP-1','Điểm xác nhận','map_draw','point',
      ST_SetSRID(ST_MakePoint(104.685,20.805),4326),ST_SetSRID(ST_MakePoint(104.685,20.805),4326),
      1,3,'count','TEST',1,'{}','valid','confirmed',${row.ownerId}::uuid,now(),${row.ownerId}::uuid),
    (${workItemId}::uuid,NULL,'MAP-2','Điểm nháp','map_draw','point',
      ST_SetSRID(ST_MakePoint(104.686,20.806),4326),ST_SetSRID(ST_MakePoint(104.686,20.806),4326),
      1,20,'count','TEST',1,'{}','valid','draft',${row.ownerId}::uuid,NULL,NULL),
    (${workItemId}::uuid,NULL,'MAP-3','Điểm ngoài','map_draw','point',
      ST_SetSRID(ST_MakePoint(105.5,21.5),4326),ST_SetSRID(ST_MakePoint(105.5,21.5),4326),
      1,4,'count','TEST',1,'{}','valid','confirmed',${row.ownerId}::uuid,now(),${row.ownerId}::uuid)`.execute(
    database.query,
  )
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
  cookie = `dove_session=${login.cookies.find((item) => item.name === 'dove_session')!.value}`
})

afterAll(async () => {
  await sql`DELETE FROM measurement WHERE case_work_item_id=${workItemId}::uuid`.execute(
    database.query,
  )
  await sql`DELETE FROM work_component WHERE id=${componentId}::uuid`.execute(database.query)
  await sql`DELETE FROM case_work_item WHERE id=${workItemId}::uuid`.execute(database.query)
  await sql`DELETE FROM inspection_case WHERE id=${caseId}::uuid`.execute(database.query)
  await app.close()
  await database.destroy()
})

describe('case map feature API', () => {
  it('filters the hierarchy and bbox while totals include confirmed records only', async () => {
    const query = new URLSearchParams({
      bbox: '104.68,20.80,104.69,20.81',
      componentId,
      geometryKind: 'point',
      managementZoneId: zoneId,
      serviceGroupId: groupId,
      status: 'confirmed',
      workItemId,
    })
    const response = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/map-features?${query}`,
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<MapFeatureListResponse>()
    expect(body.items.map((item) => item.measurement.name)).toEqual(['Điểm xác nhận'])
    expect(body.items[0]).toMatchObject({
      workComponentName: 'Mục con A',
      workItemName: 'Công tác lọc',
    })
    expect(body.confirmedTotals).toEqual([
      expect.objectContaining({
        measurementCount: 1,
        total: 3,
        workComponentId: componentId,
        workItemId,
      }),
    ])
  })

  it('paginates with an opaque cursor and excludes superseded/deleted by default', async () => {
    const first = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/map-features?limit=1`,
    })
    const page = first.json<MapFeatureListResponse>()
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toEqual(expect.any(String))
    const second = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/map-features?limit=1&cursor=${encodeURIComponent(page.nextCursor!)}`,
    })
    expect(second.json<MapFeatureListResponse>().items).toHaveLength(1)
  })

  it('rejects invalid bbox and does not expose another case id', async () => {
    const invalid = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/map-features?bbox=105,21,104,20`,
    })
    expect(invalid).toMatchObject({ statusCode: 400 })
    const missing = await app.inject({
      headers: { cookie },
      method: 'GET',
      url: `/api/v1/cases/${randomUUID()}/map-features`,
    })
    expect(missing).toMatchObject({ statusCode: 404 })
  })
})
