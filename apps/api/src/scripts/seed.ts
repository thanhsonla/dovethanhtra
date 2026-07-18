import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { hash } from '@node-rs/argon2'
import { sql } from 'kysely'

import { loadConfig } from '../config.js'
import { IdentityRepository } from '../modules/identity/identity-repository.js'
import { createDatabase } from '../platform/database.js'

interface CatalogFile {
  catalogVersion: number
  serviceGroups: Array<{
    code: string
    color: string
    displayOrder: number
    name: string
    workTypes: Array<{
      attributes?: string[]
      baseUnit: string
      calculation: Record<string, unknown> & { version: number }
      code: string
      measurementKind: string
      name: string
    }>
  }>
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const config = loadConfig()
const database = createDatabase(config.databaseUrl)
const sampleBoundaryWkt =
  'MULTIPOLYGON(((104.62 20.75,104.75 20.75,104.75 20.86,104.62 20.86,104.62 20.75)))'
const sampleBoundaryHash = createHash('sha256').update(sampleBoundaryWkt).digest('hex')

try {
  const catalogPath = fileURLToPath(
    new URL('../../../../config/work-catalog.example.json', import.meta.url),
  )
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as CatalogFile
  const identity = new IdentityRepository(database.query)
  const passwordHash = await hash(required('BOOTSTRAP_OWNER_PASSWORD'))

  const user = await identity.upsertBootstrapUser({
    displayName: required('BOOTSTRAP_OWNER_NAME'),
    email: required('BOOTSTRAP_OWNER_EMAIL'),
    passwordHash,
    role: 'owner',
  })

  await sql`
    INSERT INTO admin_area (
      code, name, area_type, valid_from, boundary, source, source_version, source_hash, metadata
    ) VALUES (
      'M1_SAMPLE_AREA',
      'Địa bàn mẫu Mốc 1',
      'sample',
      '2020-01-01'::date,
      ST_GeomFromText(${sampleBoundaryWkt}, 4326),
      'M1_SAMPLE_NOT_FOR_OFFICIAL_MEASUREMENT',
      'sample-v1',
      ${sampleBoundaryHash},
      ${JSON.stringify({
        disclaimer:
          'Fixture kỹ thuật; không dùng làm ranh giới hành chính hoặc phép đo chính thức.',
      })}::jsonb
    )
    ON CONFLICT (code, source_version) DO UPDATE SET
      name = EXCLUDED.name,
      boundary = EXCLUDED.boundary,
      source_hash = EXCLUDED.source_hash,
      metadata = EXCLUDED.metadata
  `.execute(database.query)

  await database.query.transaction().execute(async (transaction) => {
    for (const group of catalog.serviceGroups) {
      const groupResult = await sql<{ id: string }>`
        INSERT INTO service_group (code, name, display_order, color)
        VALUES (${group.code}, ${group.name}, ${group.displayOrder}, ${group.color})
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          display_order = EXCLUDED.display_order,
          color = EXCLUDED.color,
          active = true
        RETURNING id
      `.execute(transaction)
      const groupId = groupResult.rows[0]?.id
      if (!groupId) throw new Error(`Không thể seed nhóm dịch vụ ${group.code}.`)

      for (const workType of group.workTypes) {
        await sql`
          INSERT INTO work_type (
            service_group_id, code, name, measurement_kind, base_unit,
            attribute_schema, calculation_spec, calculation_version
          ) VALUES (
            ${groupId}::uuid, ${workType.code}, ${workType.name},
            ${workType.measurementKind}::measurement_kind, ${workType.baseUnit},
            ${JSON.stringify({ fields: workType.attributes ?? [] })}::jsonb,
            ${JSON.stringify(workType.calculation)}::jsonb,
            ${workType.calculation.version}
          )
          ON CONFLICT (code, calculation_version) DO UPDATE SET
            service_group_id = EXCLUDED.service_group_id,
            name = EXCLUDED.name,
            measurement_kind = EXCLUDED.measurement_kind,
            base_unit = EXCLUDED.base_unit,
            attribute_schema = EXCLUDED.attribute_schema,
            calculation_spec = EXCLUDED.calculation_spec,
            active = true
        `.execute(transaction)
      }
    }

    await sql`
      INSERT INTO treatment_facility (
        code, name, facility_type, admin_area_id, location, address, metadata, created_by
      ) SELECT
        'M3_SAMPLE_TREATMENT', 'Cơ sở xử lý mẫu Mốc 3', 'treatment_facility', a.id,
        ST_SetSRID(ST_MakePoint(104.72, 20.82), 4326), 'Fixture kỹ thuật',
        '{"disclaimer":"Không dùng làm cơ sở xử lý chính thức."}'::jsonb, ${user.id}::uuid
      FROM admin_area a WHERE a.code = 'M1_SAMPLE_AREA'
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = true
    `.execute(transaction)
  })

  process.stdout.write(
    `Seed Mốc 1 hoàn tất: ${catalog.serviceGroups.length} nhóm dịch vụ, ` +
      `${catalog.serviceGroups.reduce((total, group) => total + group.workTypes.length, 0)} công tác, ` +
      `tài khoản ${user.email}.\n`,
  )
} finally {
  await database.destroy()
}
