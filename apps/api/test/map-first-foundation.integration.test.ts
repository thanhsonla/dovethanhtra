import { randomUUID } from 'node:crypto'

import { sql, type Transaction } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createDatabase, type DatabaseHandle } from '../src/platform/database.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests.')

let database: DatabaseHandle
const rollbackMarker = new Error('ROLLBACK_MAP_FIRST_FIXTURE')

async function withRollback(
  callback: (transaction: Transaction<Record<string, never>>) => Promise<void>,
): Promise<void> {
  try {
    await database.query.transaction().execute(async (transaction) => {
      await callback(transaction)
      throw rollbackMarker
    })
  } catch (error) {
    if (error !== rollbackMarker) throw error
  }
}

async function createCaseFixture(executor: Transaction<Record<string, never>>) {
  const suffix = randomUUID().slice(0, 8)
  const result = await sql<{ caseId: string; ownerId: string }>`
    INSERT INTO inspection_case (
      case_code, name, admin_area_id, boundary_snapshot, period_start, period_end, owner_id
    )
    SELECT ${`MF-${suffix}`}, ${`Map-first ${suffix}`}, a.id, a.boundary,
      '2026-07-01'::date, '2026-07-31'::date, u.id
    FROM admin_area a CROSS JOIN app_user u
    WHERE a.code = 'M1_SAMPLE_AREA' AND u.email = ${process.env.BOOTSTRAP_OWNER_EMAIL}
    LIMIT 1
    RETURNING id AS "caseId", owner_id AS "ownerId"
  `.execute(executor)
  const fixture = result.rows[0]
  if (!fixture) throw new Error('Không tạo được fixture map-first.')
  return fixture
}

beforeAll(() => {
  database = createDatabase(databaseUrl)
})

afterAll(async () => {
  await database.destroy()
})

describe('Map-first foundation migration', () => {
  it('seeds exactly four quick fields while preserving historical groups', async () => {
    const result = await sql<{
      code: string
      quickDefault: boolean
      quickLabel: string | null
    }>`
      SELECT code, quick_default AS "quickDefault", quick_label AS "quickLabel"
      FROM service_group
      WHERE active AND deleted_at IS NULL
      ORDER BY display_order, code
    `.execute(database.query)

    expect(result.rows.filter((group) => group.quickDefault)).toEqual([
      { code: 'ENV_SANITATION', quickDefault: true, quickLabel: 'Vệ sinh môi trường' },
      { code: 'GREENERY', quickDefault: true, quickLabel: 'Cây xanh' },
      { code: 'LIGHTING', quickDefault: true, quickLabel: 'Chiếu sáng' },
      {
        code: 'WASTEWATER_DRAINAGE',
        quickDefault: true,
        quickLabel: 'Thoát nước thải',
      },
    ])
    expect(result.rows.map((group) => group.code)).toEqual(
      expect.arrayContaining(['WASTE_TRANSPORT', 'URBAN_BEAUTIFICATION']),
    )
  })

  it('backfills legacy work items and supports draft/component links without changing totals', async () => {
    await withRollback(async (transaction) => {
      const fixture = await createCaseFixture(transaction)
      const workResult = await sql<{
        id: string
        measurementKind: string
        serviceGroupId: string
        templateGroupId: string
      }>`
        INSERT INTO case_work_item (
          inspection_case_id, work_type_id, name, unit, formula_snapshot
        )
        SELECT ${fixture.caseId}::uuid, wt.id, 'Chiều dài thử nghiệm', wt.base_unit,
          wt.calculation_spec
        FROM work_type wt WHERE wt.code = 'LIGHTING_CABLE_LENGTH'
        RETURNING id, measurement_kind AS "measurementKind",
          service_group_id AS "serviceGroupId",
          (SELECT service_group_id FROM work_type WHERE id = case_work_item.work_type_id)
            AS "templateGroupId"
      `.execute(transaction)
      const work = workResult.rows[0]!
      expect(work.measurementKind).toBe('line')
      expect(work.serviceGroupId).toBe(work.templateGroupId)

      const component = await sql<{ id: string }>`
        INSERT INTO work_component (case_work_item_id, name, created_by)
        VALUES (${work.id}::uuid, 'Đường kiểm thử', ${fixture.ownerId}::uuid)
        RETURNING id
      `.execute(transaction)
      const componentId = component.rows[0]!.id

      const draft = await sql<{ id: string }>`
        INSERT INTO capture_draft (
          inspection_case_id, local_id, device_id, idempotency_key, payload_hash,
          geometry_kind, raw_geometry, created_by
        ) VALUES (
          ${fixture.caseId}::uuid, ${randomUUID()}, 'test-device', ${randomUUID()},
          ${'a'.repeat(64)}, 'line', ST_GeomFromText('LINESTRING(104.6 20.7,104.7 20.8)',4326),
          ${fixture.ownerId}::uuid
        ) RETURNING id
      `.execute(transaction)
      const draftId = draft.rows[0]!.id

      const beforeClassification = await sql<{ count: number }>`
        SELECT count(*)::integer AS count FROM measurement
        WHERE capture_draft_id = ${draftId}::uuid
      `.execute(transaction)
      expect(beforeClassification.rows[0]?.count).toBe(0)

      const measurement = await sql<{ id: string }>`
        INSERT INTO measurement (
          case_work_item_id, work_component_id, capture_draft_id, code, name, method,
          geometry_kind, raw_geometry, normalized_geometry, base_value, calculated_quantity,
          unit, calculation_rule_code, calculation_version, validation_status, created_by
        ) VALUES (
          ${work.id}::uuid, ${componentId}::uuid, ${draftId}::uuid, ${`MF-${randomUUID()}`},
          'Đoạn thử nghiệm', 'map_draw', 'line',
          ST_GeomFromText('LINESTRING(104.6 20.7,104.7 20.8)',4326),
          ST_GeomFromText('LINESTRING(104.6 20.7,104.7 20.8)',4326),
          1, 1, 'm', 'RULE-LENGTH-1', 1, 'valid', ${fixture.ownerId}::uuid
        ) RETURNING id
      `.execute(transaction)
      const measurementId = measurement.rows[0]!.id

      await sql`
        UPDATE capture_draft SET status = 'classified',
          classified_measurement_id = ${measurementId}::uuid, classified_at = now()
        WHERE id = ${draftId}::uuid
      `.execute(transaction)

      const linked = await sql<{ linked: boolean }>`
        SELECT cd.classified_measurement_id = m.id
          AND m.work_component_id = ${componentId}::uuid AS linked
        FROM capture_draft cd JOIN measurement m ON m.capture_draft_id = cd.id
        WHERE cd.id = ${draftId}::uuid
      `.execute(transaction)
      expect(linked.rows[0]?.linked).toBe(true)
    })
  })

  it('rejects geometry kinds that do not match the raw capture geometry', async () => {
    await expect(
      database.query.transaction().execute(async (transaction) => {
        const fixture = await createCaseFixture(transaction)
        await sql`
          INSERT INTO capture_draft (
            inspection_case_id, local_id, device_id, idempotency_key, payload_hash,
            geometry_kind, raw_geometry, created_by
          ) VALUES (
            ${fixture.caseId}::uuid, ${randomUUID()}, 'test-device', ${randomUUID()},
            ${'b'.repeat(64)}, 'area',
            ST_GeomFromText('LINESTRING(104.6 20.7,104.7 20.8)',4326),
            ${fixture.ownerId}::uuid
          )
        `.execute(transaction)
      }),
    ).rejects.toThrow(/capture_draft_geometry_kind/)
  })
})
