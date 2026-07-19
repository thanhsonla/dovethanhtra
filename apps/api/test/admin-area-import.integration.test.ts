import { randomUUID } from 'node:crypto'

import type { AdminArea } from '@dove/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import {
  importAdminAreas,
  parseAdminAreaGeoJson,
} from '../src/modules/admin-areas/admin-area-import.js'
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

function source(code: string, name = 'Địa bàn import kiểm thử') {
  return Buffer.from(
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            areaType: 'test',
            code,
            name,
            source: 'Integration fixture',
            sourceVersion: 'integration-v1',
            validFrom: '2026-01-01',
            validTo: null,
          },
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [104.6, 20.7],
                  [104.7, 20.7],
                  [104.7, 20.8],
                  [104.6, 20.8],
                  [104.6, 20.7],
                ],
              ],
            ],
          },
        },
      ],
    }),
  )
}

function supersedingSource(code: string) {
  const value = JSON.parse(source(code).toString('utf8')) as {
    features: Array<{ properties: Record<string, unknown> }>
  }
  Object.assign(value.features[0]!.properties, {
    sourceVersion: 'integration-v2',
    supersedesSourceVersion: 'integration-v1',
    validFrom: '2026-02-01',
  })
  return Buffer.from(JSON.stringify(value))
}

describe('admin area import pipeline', () => {
  it('is idempotent by source hash and refuses silent replacement', async () => {
    const code = `IMPORT_${randomUUID().slice(0, 8).toUpperCase()}`
    const parsed = parseAdminAreaGeoJson(source(code))
    await expect(
      database.query.transaction().execute((transaction) => importAdminAreas(transaction, parsed)),
    ).resolves.toEqual({ inserted: 1, skipped: 0, superseded: 0 })
    await expect(
      database.query.transaction().execute((transaction) => importAdminAreas(transaction, parsed)),
    ).resolves.toEqual({ inserted: 0, skipped: 1, superseded: 0 })

    const changed = parseAdminAreaGeoJson(source(code, 'Tên bị thay âm thầm'))
    await expect(
      database.query.transaction().execute((transaction) => importAdminAreas(transaction, changed)),
    ).rejects.toThrow(/sourceVersion mới/)

    const superseding = parseAdminAreaGeoJson(supersedingSource(code))
    await expect(
      database.query
        .transaction()
        .execute((transaction) => importAdminAreas(transaction, superseding)),
    ).resolves.toEqual({ inserted: 1, skipped: 0, superseded: 1 })
    await expect(
      database.query
        .transaction()
        .execute((transaction) => importAdminAreas(transaction, superseding)),
    ).resolves.toEqual({ inserted: 0, skipped: 1, superseded: 0 })

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: process.env.BOOTSTRAP_OWNER_EMAIL,
        password: process.env.BOOTSTRAP_OWNER_PASSWORD,
      },
    })
    const session = login.cookies.find((item) => item.name === 'dove_session')
    const response = await app.inject({
      headers: { cookie: `dove_session=${session!.value}` },
      method: 'GET',
      url: '/api/v1/admin-areas',
    })
    expect(response.statusCode).toBe(200)
    expect(response.json<AdminArea[]>().find((item) => item.code === code)).toMatchObject({
      source: 'Integration fixture',
      sourceHash: superseding.sourceHash,
      sourceVersion: 'integration-v2',
    })
  })
})
