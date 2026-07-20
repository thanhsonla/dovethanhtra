import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'

import type { AppConfig } from './config.js'
import { adminAreaRoutes } from './modules/admin-areas/admin-area-routes.js'
import { AdminAreaRepository } from './modules/admin-areas/admin-area-repository.js'
import { basemapRoutes } from './modules/basemaps/basemap-routes.js'
import type { GoogleMapTiles } from './modules/basemaps/google-map-tiles-provider.js'
import { AuditRepository } from './modules/audit/audit-repository.js'
import { auditRoutes } from './modules/audit/audit-routes.js'
import { CaseRepository } from './modules/cases/case-repository.js'
import { CaseCaptureClassificationAdapter } from './modules/cases/capture-classification-adapter.js'
import { caseRoutes } from './modules/cases/case-routes.js'
import { CaseService } from './modules/cases/case-service.js'
import { CatalogRepository } from './modules/catalog/catalog-repository.js'
import { catalogRoutes } from './modules/catalog/catalog-routes.js'
import { CatalogService } from './modules/catalog/catalog-service.js'
import { ManagementZoneRepository } from './modules/catalog/management-zone-repository.js'
import { managementZoneRoutes } from './modules/catalog/management-zone-routes.js'
import { ManagementZoneService } from './modules/catalog/management-zone-service.js'
import { ComparisonRepository } from './modules/comparison/comparison-repository.js'
import { comparisonRoutes } from './modules/comparison/comparison-routes.js'
import { ComparisonService } from './modules/comparison/comparison-service.js'
import { WorkStructureRepository } from './modules/cases/work-structure-repository.js'
import { workStructureRoutes } from './modules/cases/work-structure-routes.js'
import { WorkStructureService } from './modules/cases/work-structure-service.js'
import { ExportRepository } from './modules/exports/export-repository.js'
import { exportRoutes } from './modules/exports/export-routes.js'
import { ExportService } from './modules/exports/export-service.js'
import { LocalExportProvider } from './modules/exports/local-export-provider.js'
import { SnapshotRepository } from './modules/exports/snapshot-repository.js'
import { healthRoutes } from './modules/health/health-routes.js'
import { EvidenceService } from './modules/field/evidence-service.js'
import { fieldRoutes } from './modules/field/field-routes.js'
import { GpsService } from './modules/field/gps-service.js'
import { UnavailableMalwareScanner, type MalwareScanner } from './modules/field/malware-scanner.js'
import { SharpThumbnailer, type Thumbnailer } from './modules/field/thumbnailer.js'
import { createAuthGuards } from './modules/identity/auth-guards.js'
import { IdentityRepository } from './modules/identity/identity-repository.js'
import { identityRoutes } from './modules/identity/identity-routes.js'
import { IdentityService } from './modules/identity/identity-service.js'
import { CaptureDraftRepository } from './modules/measurements/capture-draft-repository.js'
import { captureDraftRoutes } from './modules/measurements/capture-draft-routes.js'
import { CaptureDraftService } from './modules/measurements/capture-draft-service.js'
import { MeasurementRepository } from './modules/measurements/measurement-repository.js'
import { measurementRoutes } from './modules/measurements/measurement-routes.js'
import { MeasurementService } from './modules/measurements/measurement-service.js'
import { MapFeatureRepository } from './modules/measurements/map-feature-repository.js'
import { mapFeatureRoutes } from './modules/measurements/map-feature-routes.js'
import { MapFeatureService } from './modules/measurements/map-feature-service.js'
import { LocalRoutingProvider } from './modules/routing/local-routing-provider.js'
import { RoutingRepository } from './modules/routing/routing-repository.js'
import { routingRoutes } from './modules/routing/routing-routes.js'
import { RoutingService } from './modules/routing/routing-service.js'
import type { RoutingProvider } from './modules/routing/routing-provider.js'
import { AppError } from './platform/app-error.js'
import type { DatabaseHandle } from './platform/database.js'
import type { ObjectStorageHandle } from './platform/object-storage.js'
import { registerSecurityHeaders } from './platform/request-security.js'

export interface BuildAppOptions {
  auth: AppConfig['auth']
  dependencies: {
    database: DatabaseHandle
    objectStorage: ObjectStorageHandle
  }
  logger?: FastifyServerOptions['logger']
  basemaps?: { googleMapTiles?: GoogleMapTiles | null }
  routing?: {
    provider?: RoutingProvider
    requestsPerMinute?: number
  }
  security?: { loginRequestsPerMinute?: number }
  evidence?: { malwareScanner?: MalwareScanner; thumbnailer?: Thumbnailer }
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    requestIdHeader: 'x-request-id',
  })
  registerSecurityHeaders(app, options.auth.cookieSecure)

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
  const snapshots = new SnapshotRepository()
  const caseRepository = new CaseRepository(database)
  const workStructureRepository = new WorkStructureRepository(database)
  const cases = new CaseService(database, caseRepository, audit, snapshots)
  const workStructure = new WorkStructureService(database, workStructureRepository, audit)
  const comparison = new ComparisonService(database, new ComparisonRepository(database), audit)
  const exports = new ExportService(
    database,
    new ExportRepository(database),
    snapshots,
    comparison,
    audit,
    new LocalExportProvider(),
    options.dependencies.objectStorage,
  )
  await exports.resumePending()
  const measurementRepository = new MeasurementRepository(database)
  const measurements = new MeasurementService(database, measurementRepository, audit)
  const captureDrafts = new CaptureDraftService(
    database,
    new CaptureDraftRepository(database),
    measurementRepository,
    new CaseCaptureClassificationAdapter(caseRepository, workStructureRepository),
    audit,
  )
  const routing = new RoutingService(
    database,
    new RoutingRepository(database),
    measurementRepository,
    audit,
    options.routing?.provider ?? new LocalRoutingProvider(),
    options.routing?.requestsPerMinute ?? 30,
  )
  const gps = new GpsService(database, measurementRepository, audit)
  const evidence = new EvidenceService(
    database,
    options.dependencies.objectStorage,
    audit,
    options.evidence?.malwareScanner ?? new UnavailableMalwareScanner(),
    options.evidence?.thumbnailer ?? new SharpThumbnailer(),
  )

  await app.register(healthRoutes, {
    dependencies: options.dependencies,
    prefix: '/api/v1/health',
  })
  await app.register(identityRoutes, {
    config: options.auth,
    guards,
    loginRequestsPerMinute: options.security?.loginRequestsPerMinute ?? 5,
    prefix: '/api/v1/auth',
    service: identity,
  })
  await app.register(adminAreaRoutes, {
    guards,
    prefix: '/api/v1/admin-areas',
    repository: new AdminAreaRepository(database),
  })
  await app.register(basemapRoutes, {
    googleMapTiles: options.basemaps?.googleMapTiles ?? null,
    guards,
    prefix: '/api/v1/basemaps',
  })
  await app.register(catalogRoutes, {
    guards,
    prefix: '/api/v1/catalog',
    service: new CatalogService(database, catalogRepository, audit),
  })
  await app.register(managementZoneRoutes, {
    guards,
    prefix: '/api/v1/catalog/management-zones',
    service: new ManagementZoneService(database, new ManagementZoneRepository(database), audit),
  })
  await app.register(caseRoutes, { guards, prefix: '/api/v1/cases', service: cases })
  await app.register(workStructureRoutes, { guards, prefix: '/api/v1', service: workStructure })
  await app.register(measurementRoutes, {
    guards,
    prefix: '/api/v1',
    service: measurements,
  })
  await app.register(mapFeatureRoutes, {
    guards,
    prefix: '/api/v1/cases',
    service: new MapFeatureService(new MapFeatureRepository(database)),
  })
  await app.register(captureDraftRoutes, { guards, prefix: '/api/v1', service: captureDrafts })
  await app.register(routingRoutes, { guards, prefix: '/api/v1', service: routing })
  await app.register(fieldRoutes, { evidence, gps, guards, prefix: '/api/v1' })
  await app.register(comparisonRoutes, { guards, prefix: '/api/v1', service: comparison })
  await app.register(exportRoutes, { guards, prefix: '/api/v1', service: exports })
  await app.register(auditRoutes, {
    guards,
    prefix: '/api/v1/cases/:caseId/audit-events',
    repository: audit,
  })

  return app
}
