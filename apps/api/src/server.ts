import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDatabase } from './platform/database.js'
import { createObjectStorage } from './platform/object-storage.js'
import { LocalRoutingProvider } from './modules/routing/local-routing-provider.js'
import { MapboxRoutingProvider } from './modules/routing/mapbox-routing-provider.js'

const config = loadConfig()
const database = createDatabase(config.databaseUrl)
const objectStorage = createObjectStorage(config.objectStorage)
if (config.routing.provider === 'mapbox' && !config.routing.mapboxAccessToken) {
  throw new Error('MAPBOX_ACCESS_TOKEN is required when ROUTING_PROVIDER=mapbox')
}
const routingProvider =
  config.routing.provider === 'mapbox'
    ? new MapboxRoutingProvider(config.routing.mapboxAccessToken!, config.routing.timeoutMs)
    : new LocalRoutingProvider()
const app = await buildApp({
  auth: config.auth,
  dependencies: { database, objectStorage },
  logger: { level: config.logLevel },
  routing: { provider: routingProvider, requestsPerMinute: config.routing.requestsPerMinute },
  security: config.security,
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
