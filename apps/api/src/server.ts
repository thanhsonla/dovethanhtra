import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDatabase } from './platform/database.js'
import { createObjectStorage } from './platform/object-storage.js'

const config = loadConfig()
const database = createDatabase(config.databaseUrl)
const objectStorage = createObjectStorage(config.objectStorage)
const app = await buildApp({
  auth: config.auth,
  dependencies: { database, objectStorage },
  logger: { level: config.logLevel },
})

const shutdown = async () => {
  await app.close()
  await database.destroy()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

try {
  await app.listen({ host: config.apiHost, port: config.apiPort })
} catch (error) {
  app.log.error(error)
  await shutdown()
  process.exitCode = 1
}
