import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely'
import { Pool, type PoolConfig } from 'pg'

type DatabaseSchema = Record<string, never>

export type AppDatabase = Kysely<DatabaseSchema>
export type QueryExecutor = AppDatabase | Transaction<DatabaseSchema>

export interface DatabaseHandle {
  check(): Promise<boolean>
  destroy(): Promise<void>
  query: AppDatabase
}

export function createDatabase(databaseUrl: string): DatabaseHandle {
  const needsSslBypass =
    databaseUrl.includes('supabase') ||
    databaseUrl.includes('sslmode=') ||
    databaseUrl.includes('pooler')

  const poolConfig: PoolConfig = {
    connectionString: databaseUrl,
    max: 5,
    ...(needsSslBypass ? { ssl: { rejectUnauthorized: false } } : {}),
  }

  const database = new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({
      pool: new Pool(poolConfig),
    }),
  })

  return {
    async check() {
      const result = await sql<{ postgisVersion: string | null }>`
        select postgis_full_version() as "postgisVersion"
      `.execute(database)
      return Boolean(result.rows[0]?.postgisVersion)
    },
    async destroy() {
      await database.destroy()
    },
    query: database,
  }
}
