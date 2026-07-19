import { Client } from 'pg'

const sourceUrl = process.env.DATABASE_URL
const testUrl = process.env.TEST_DATABASE_URL
if (!sourceUrl || !testUrl) {
  throw new Error('DATABASE_URL and TEST_DATABASE_URL are required.')
}

const target = new URL(testUrl)
const databaseName = decodeURIComponent(target.pathname.slice(1))
if (!/^[a-zA-Z0-9_]+$/.test(databaseName) || databaseName === 'postgres') {
  throw new Error('TEST_DATABASE_URL must use a dedicated, safely named test database.')
}

const adminUrl = new URL(sourceUrl)
adminUrl.pathname = '/postgres'
const client = new Client({ connectionString: adminUrl.toString() })

try {
  await client.connect()
  const exists = await client.query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
    [databaseName],
  )
  if (!exists.rows[0]?.exists) {
    await client.query(`CREATE DATABASE "${databaseName}"`)
    process.stdout.write(`Created isolated test database ${databaseName}.\n`)
  } else {
    process.stdout.write(`Isolated test database ${databaseName} already exists.\n`)
  }
} finally {
  await client.end()
}
