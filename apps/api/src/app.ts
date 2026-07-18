import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'

import type { AppConfig } from './config.js'
import { adminAreaRoutes } from './modules/admin-areas/admin-area-routes.js'
import { AdminAreaRepository } from './modules/admin-areas/admin-area-repository.js'
import { AuditRepository } from './modules/audit/audit-repository.js'
import { auditRoutes } from './modules/audit/audit-routes.js'
import { CaseRepository } from './modules/cases/case-repository.js'
import { caseRoutes } from './modules/cases/case-routes.js'
import { CaseService } from './modules/cases/case-service.js'
import { CatalogRepository } from './modules/catalog/catalog-repository.js'
import { catalogRoutes } from './modules/catalog/catalog-routes.js'
import { CatalogService } from './modules/catalog/catalog-service.js'
import { healthRoutes } from './modules/health/health-routes.js'
import { EvidenceService } from './modules/field/evidence-service.js'
import { fieldRoutes } from './modules/field/field-routes.js'
import { GpsService } from './modules/field/gps-service.js'
import { createAuthGuards } from './modules/identity/auth-guards.js'
import { IdentityRepository } from './modules/identity/identity-repository.js'
import { identityRoutes } from './modules/identity/identity-routes.js'
import { IdentityService } from './modules/identity/identity-service.js'
import { MeasurementRepository } from './modules/measurements/measurement-repository.js'
import { measurementRoutes } from './modules/measurements/measurement-routes.js'
import { MeasurementService } from './modules/measurements/measurement-service.js'
import { LocalRoutingProvider } from './modules/routing/local-routing-provider.js'
import { RoutingRepository } from './modules/routing/routing-repository.js'
import { routingRoutes } from './modules/routing/routing-routes.js'
import { RoutingService } from './modules/routing/routing-service.js'
import type { RoutingProvider } from './modules/routing/routing-provider.js'
import { AppError } from './platform/app-error.js'
import type { DatabaseHandle } from './platform/database.js'
import type { ObjectStorageHandle } from './platform/object-storage.js'

export interface BuildAppOptions {
  auth: AppConfig['auth']
  dependencies: {
    database: DatabaseHandle
    objectStorage: ObjectStorageHandle
  }
  logger?: FastifyServerOptions['logger']
  routing?: {
    provider?: RoutingProvider
    requestsPerMinute?: number
  }
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    requestIdHeader: 'x-request-id',
  })

  await app.register(cookie)
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'API kiểm tra khối lượng hiện trường',
        version: '0.0.0',
      },
      servers: [{ url: '/api/v1' }],
      components: {
        securitySchemes: {
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'dove_session' },
          csrfToken: { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
        },
      },
    },
  })
  await app.register(swaggerUi, { routePrefix: '/documentation' })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        traceId: request.id,
      })
    }
    if (error && typeof error === 'object' && 'validation' in error && error.validation) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu yêu cầu không hợp lệ.',
        details: { validation: error.validation },
        traceId: request.id,
      })
    }
    request.log.error({ err: error }, 'Unhandled request error')
    return reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Máy chủ không thể xử lý yêu cầu.',
      traceId: request.id,
    })
  })

  const database = options.dependencies.database.query
  const identityRepository = new IdentityRepository(database)
  const identity = new IdentityService(database, identityRepository, options.auth.sessionTtlHours)
  const guards = createAuthGuards(identity)
  const audit = new AuditRepository(database)
  const catalogRepository = new CatalogRepository(database)
  const cases = new CaseService(database, new CaseRepository(database), audit)
  const measurementRepository = new MeasurementRepository(database)
  const measurements = new MeasurementService(database, measurementRepository, audit)
  const routing = new RoutingService(
    database,
    new RoutingRepository(database),
    measurementRepository,
    audit,
    options.routing?.provider ?? new LocalRoutingProvider(),
    options.routing?.requestsPerMinute ?? 30,
  )
  const gps = new GpsService(database, measurementRepository, audit)
  const evidence = new EvidenceService(database, options.dependencies.objectStorage, audit)

  await app.register(healthRoutes, {
    dependencies: options.dependencies,
    prefix: '/api/v1/health',
  })
  await app.register(identityRoutes, {
    config: options.auth,
    guards,
    prefix: '/api/v1/auth',
    service: identity,
  })
  await app.register(adminAreaRoutes, {
    guards,
    prefix: '/api/v1/admin-areas',
    repository: new AdminAreaRepository(database),
  })
  await app.register(catalogRoutes, {
    guards,
    prefix: '/api/v1/catalog',
    service: new CatalogService(database, catalogRepository, audit),
  })
  await app.register(caseRoutes, { guards, prefix: '/api/v1/cases', service: cases })
  await app.register(measurementRoutes, {
    guards,
    prefix: '/api/v1',
    service: measurements,
  })
  await app.register(routingRoutes, { guards, prefix: '/api/v1', service: routing })
  await app.register(fieldRoutes, { evidence, gps, guards, prefix: '/api/v1' })
  await app.register(auditRoutes, {
    guards,
    prefix: '/api/v1/cases/:caseId/audit-events',
    repository: audit,
  })

  return app
}
