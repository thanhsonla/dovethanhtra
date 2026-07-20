import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import { sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { ExportDataset } from '../src/modules/exports/export-provider.js'
import { ExportRepository } from '../src/modules/exports/export-repository.js'
import { LocalExportProvider } from '../src/modules/exports/local-export-provider.js'
import { MapFeatureRepository } from '../src/modules/measurements/map-feature-repository.js'
import { createDatabase, type DatabaseHandle } from '../src/platform/database.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for performance tests.')

let database: DatabaseHandle
const caseId = randomUUID()
const workItemId = randomUUID()
let ownerId = ''

beforeAll(async () => {
  database = createDatabase(databaseUrl)
  const fixture = await sql<{ areaId: string; ownerId: string; workTypeId: string }>`
    SELECT a.id AS "areaId",u.id AS "ownerId",t.id AS "workTypeId"
    FROM admin_area a CROSS JOIN app_user u CROSS JOIN work_type t
    WHERE u.email=${process.env.BOOTSTRAP_OWNER_EMAIL!} AND t.measurement_kind='point'
    LIMIT 1`.execute(database.query)
  const row = fixture.rows[0]!
  ownerId = row.ownerId
  await sql`INSERT INTO inspection_case
    (id,case_code,name,admin_area_id,boundary_snapshot,period_start,period_end,status,owner_id,
      locked_at,locked_by,lock_reason)
    SELECT ${caseId}::uuid,${`M6-PERF-${caseId.slice(0, 8)}`},'M6 performance fixture',a.id,
      a.boundary,'2026-07-01','2026-07-31','locked',${ownerId}::uuid,now(),${ownerId}::uuid,
      'Mốc 6 performance fixture'
    FROM admin_area a WHERE a.id=${row.areaId}::uuid`.execute(database.query)
  await sql`INSERT INTO case_work_item
    (id,inspection_case_id,work_type_id,name,unit,formula_snapshot,warning_threshold)
    SELECT ${workItemId}::uuid,${caseId}::uuid,t.id,'10.000 điểm hiệu năng',t.base_unit,
      jsonb_build_object('workTypeCode',t.code,'calculationVersion',t.calculation_version,
        'calculationSpec',t.calculation_spec),'{}'::jsonb
    FROM work_type t WHERE t.id=${row.workTypeId}::uuid`.execute(database.query)
  await sql`INSERT INTO measurement
    (case_work_item_id,code,name,method,geometry_kind,raw_geometry,normalized_geometry,
      base_value,calculated_quantity,unit,calculation_rule_code,calculation_version,
      calculation_output,validation_status,status,created_by,confirmed_at,confirmed_by)
    SELECT ${workItemId}::uuid,'PERF-'||n,'Điểm '||n,'map_draw','point',
      ST_SetSRID(ST_MakePoint(104.65 + (n % 100)::double precision / 100000,
        20.8 + (n / 100)::double precision / 100000),4326),
      ST_SetSRID(ST_MakePoint(104.65 + (n % 100)::double precision / 100000,
        20.8 + (n / 100)::double precision / 100000),4326),
      1,1,'count','M6-PERF',1,jsonb_build_object('quantity',1),'valid','confirmed',
      ${ownerId}::uuid,now(),${ownerId}::uuid FROM generate_series(1,10000) n`.execute(
    database.query,
  )
})

afterAll(async () => {
  await sql`DELETE FROM measurement WHERE case_work_item_id=${workItemId}::uuid`.execute(
    database.query,
  )
  await sql`DELETE FROM case_work_item WHERE id=${workItemId}::uuid`.execute(database.query)
  await sql`DELETE FROM inspection_case WHERE id=${caseId}::uuid`.execute(database.query)
  await database.destroy()
})

describe('Milestone 6 release performance', () => {
  it('loads 5.000 map geometries by bbox inside the 5 second interaction budget', async () => {
    const repository = new MapFeatureRepository(database.query)
    const started = performance.now()
    const page = await repository.list(caseId, ownerId, {
      bbox: [104.64, 20.8, 104.66, 20.8005],
      limit: 5_000,
    })
    const elapsedMs = performance.now() - started
    expect(page.items).toHaveLength(5_000)
    expect(page.nextCursor).toEqual(expect.any(Object))
    expect(elapsedMs).toBeLessThan(5_000)
  })

  it('loads 10.000 geometries and creates an XLSX inside release budgets', async () => {
    const repository = new ExportRepository(database.query)
    const loadStarted = performance.now()
    const base = await repository.dataset(caseId, ownerId)
    const loadMs = performance.now() - loadStarted
    expect(base?.measurements).toHaveLength(10_000)
    expect(loadMs).toBeLessThan(5_000)

    const dataset: ExportDataset = {
      ...base!,
      comparison: { aggregates: [], caseId, items: [] },
      generatedAt: new Date().toISOString(),
    }
    const exportStarted = performance.now()
    const artifact = await new LocalExportProvider().create('xlsx', dataset)
    const exportMs = performance.now() - exportStarted
    expect(artifact.bytes.length).toBeGreaterThan(100_000)
    expect(exportMs).toBeLessThan(30_000)
  })
})
