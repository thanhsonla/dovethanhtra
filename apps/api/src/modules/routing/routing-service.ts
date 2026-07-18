import { createHash, randomUUID } from 'node:crypto'

import type {
  CreateTreatmentFacilityRequest,
  Measurement,
  RecalculateTransportRouteRequest,
  RouteCalculation,
  RouteCandidate,
  RouteRequest,
  SaveTransportRouteRequest,
  TransportRoute,
  WeightedDistanceRequest,
} from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import type {
  MeasurementRepository,
  WorkMeasurementContext,
} from '../measurements/measurement-repository.js'
import { routeQuantities, weightedDistance } from './route-calculations.js'
import {
  RoutingProviderError,
  type ProviderRouteResult,
  type RoutingProvider,
} from './routing-provider.js'
import type { RoutingRepository } from './routing-repository.js'

const routeFingerprint = (provider: string, request: RouteRequest) =>
  createHash('sha256').update(JSON.stringify({ provider, request })).digest('hex')

export class RoutingService {
  private readonly requestTimes = new Map<string, number[]>()

  constructor(
    private readonly database: AppDatabase,
    private readonly repository: RoutingRepository,
    private readonly measurements: MeasurementRepository,
    private readonly audit: AuditRepository,
    private readonly provider: RoutingProvider,
    private readonly requestsPerMinute: number,
  ) {}

  private consumeQuota(ownerId: string) {
    const cutoff = Date.now() - 60_000
    const current = (this.requestTimes.get(ownerId) ?? []).filter((time) => time > cutoff)
    if (current.length >= this.requestsPerMinute) {
      throw new AppError(
        429,
        'ROUTING_RATE_LIMITED',
        'Bạn đã gửi quá nhiều yêu cầu định tuyến; vui lòng thử lại sau.',
      )
    }
    current.push(Date.now())
    this.requestTimes.set(ownerId, current)
  }

  private async callProvider(request: RouteRequest, ownerId: string): Promise<ProviderRouteResult> {
    this.consumeQuota(ownerId)
    try {
      const result = await this.provider.calculate(request)
      if (!result.candidates.length)
        throw new RoutingProviderError('ROUTE_NOT_FOUND', 'Không tìm được lộ trình phù hợp.')
      return result
    } catch (error) {
      if (!(error instanceof RoutingProviderError)) throw error
      const status =
        error.code === 'ROUTING_QUOTA_EXCEEDED'
          ? 429
          : error.code === 'ROUTING_TIMEOUT'
            ? 504
            : error.code === 'ROUTE_NOT_FOUND'
              ? 422
              : 503
      throw new AppError(status, error.code, error.message)
    }
  }

  async calculate(request: RouteRequest, ownerId: string): Promise<RouteCalculation> {
    const result = await this.callProvider(request, ownerId)
    return {
      calculatedAt: result.calculatedAt,
      candidates: result.candidates,
      provider: this.provider.id,
      requestFingerprint: routeFingerprint(this.provider.id, request),
    }
  }

  listFacilities(ownerId: string) {
    return this.repository.listFacilities(ownerId)
  }

  async createFacility(input: CreateTreatmentFacilityRequest, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const facility = await this.repository.createFacility(
        transaction,
        {
          ...input,
          address: input.address ?? null,
        },
        ownerId,
      )
      await this.audit.append(transaction, {
        action: 'created',
        actorId: ownerId,
        afterData: { code: facility.code, facilityType: facility.facilityType, id: facility.id },
        entityId: facility.id,
        entityType: 'treatment_facility',
        inspectionCaseId: null,
        traceId,
      })
      return facility
    })
  }

  private requireContext(context: WorkMeasurementContext | null) {
    if (!context) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
    if (context.caseStatus === 'locked')
      throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa và không thể lưu route.')
    if (context.expectedKind !== 'route')
      throw new AppError(
        422,
        'WORK_TYPE_ROUTE_MISMATCH',
        'Công tác đã chọn không có kiểu đo route.',
      )
    return context
  }

  private candidate(result: ProviderRouteResult, index: number) {
    const selected = result.candidates[index]
    if (!selected || selected.geometry.type !== 'LineString')
      throw new AppError(422, 'ROUTE_CANDIDATE_NOT_FOUND', 'Phương án route đã chọn không tồn tại.')
    return selected
  }

  private async persist(
    executor: QueryExecutor,
    workItemId: string,
    input: SaveTransportRouteRequest,
    selected: RouteCandidate,
    providerResult: ProviderRouteResult,
    context: WorkMeasurementContext,
    identity: { code: string; version: number; supersedesId?: string },
    ownerId: string,
  ): Promise<TransportRoute> {
    const quantities = routeQuantities(
      selected.distanceM,
      input.returnFactor,
      input.tripCount,
      input.transportedWeightTon,
    )
    const ruleCode =
      typeof context.formulaSnapshot.calculationSpec?.ruleCode === 'string'
        ? context.formulaSnapshot.calculationSpec.ruleCode
        : 'RULE-ROUTE-VEHICLE-KM-1'
    const quantity = ruleCode.includes('TON-KM') ? quantities.tonKm : quantities.vehicleKm
    if (quantity === null)
      throw new AppError(
        422,
        'MISSING_TRANSPORT_WEIGHT',
        'Công thức tấn.km yêu cầu khối lượng vận chuyển.',
      )
    const calculationVersion =
      typeof context.formulaSnapshot.calculationVersion === 'number'
        ? context.formulaSnapshot.calculationVersion
        : 1
    const measurementId = await this.measurements.insert(executor, {
      baseValue: selected.distanceM,
      calculatedQuantity: quantity,
      calculationInputs: {
        return_factor: input.returnFactor,
        trip_count: input.tripCount,
        ...(input.transportedWeightTon === undefined
          ? {}
          : { transported_weight_ton: input.transportedWeightTon }),
      },
      calculationOutput: { ...quantities, provider: this.provider.id },
      calculationRuleCode: ruleCode,
      calculationVersion,
      code: identity.code,
      createdBy: ownerId,
      geometryKind: 'route',
      method: 'route_provider',
      name: input.name,
      normalizedGeometry: selected.geometry,
      note: input.note ?? null,
      rawGeometry: selected.geometry,
      status: 'draft',
      ...(identity.supersedesId ? { supersedesId: identity.supersedesId } : {}),
      unit: context.unit,
      validationStatus: 'valid',
      version: identity.version,
      warnings: selected.warnings.map((code) => ({
        code,
        severity: 'warning',
        message: 'Route dùng provider kỹ thuật local; không dùng làm số liệu chính thức.',
      })),
      workItemId,
    })
    if (!(await this.measurements.confirm(executor, measurementId, ownerId))) {
      throw new AppError(500, 'ROUTE_CONFIRM_FAILED', 'Không thể xác nhận route vừa lưu.')
    }
    const routeId = await this.repository.insertRoute(executor, {
      calculatedAt: providerResult.calculatedAt,
      destination: input.request.destination,
      distanceM: selected.distanceM,
      durationS: selected.durationS,
      fingerprint: routeFingerprint(this.provider.id, input.request),
      geometry: selected.geometry,
      legs: selected.legs,
      measurementId,
      metadata: providerResult.metadata,
      origin: input.request.origin,
      profile: input.request.profile,
      provider: this.provider.id,
      request: input.request,
      returnFactor: input.returnFactor,
      ...(input.treatmentFacilityId ? { treatmentFacilityId: input.treatmentFacilityId } : {}),
      tonKm: quantities.tonKm,
      ...(input.transportedWeightTon === undefined
        ? {}
        : { transportedWeightTon: input.transportedWeightTon }),
      tripCount: input.tripCount,
      vehicleKm: quantities.vehicleKm,
      waypoints: input.request.waypoints,
    })
    await this.repository.linkRoute(executor, measurementId, routeId)
    const measurement = await this.measurements.get(executor, measurementId, ownerId)
    if (!measurement) throw new AppError(500, 'ROUTE_READ_FAILED', 'Không thể đọc route vừa lưu.')
    return this.toResponse(
      routeId,
      measurement,
      input,
      selected,
      providerResult.calculatedAt,
      quantities,
    )
  }

  private toResponse(
    id: string,
    measurement: Measurement,
    input: SaveTransportRouteRequest,
    selected: RouteCandidate,
    calculatedAt: string,
    quantities: ReturnType<typeof routeQuantities>,
  ): TransportRoute {
    return {
      id,
      measurement,
      provider: this.provider.id,
      profile: input.request.profile,
      origin: input.request.origin,
      destination: input.request.destination,
      waypoints: input.request.waypoints,
      legs: selected.legs,
      routeGeometry: selected.geometry,
      distanceOneWayM: selected.distanceM,
      durationS: selected.durationS,
      returnFactor: input.returnFactor,
      tripCount: input.tripCount,
      transportedWeightTon: input.transportedWeightTon ?? null,
      vehicleKm: quantities.vehicleKm,
      tonKm: quantities.tonKm,
      requestFingerprint: routeFingerprint(this.provider.id, input.request),
      calculatedAt,
      treatmentFacilityId: input.treatmentFacilityId ?? null,
    }
  }

  async save(
    workItemId: string,
    input: SaveTransportRouteRequest,
    ownerId: string,
    traceId: string,
  ) {
    const providerResult = await this.callProvider(input.request, ownerId)
    const selected = this.candidate(providerResult, input.candidateIndex)
    return this.database.transaction().execute(async (transaction) => {
      const context = this.requireContext(
        await this.measurements.getWorkContext(transaction, workItemId, ownerId),
      )
      if (
        input.treatmentFacilityId &&
        !(await this.repository.facilityMatchesDestination(
          transaction,
          input.treatmentFacilityId,
          input.request.destination,
        ))
      ) {
        throw new AppError(
          422,
          'ROUTE_DESTINATION_FACILITY_MISMATCH',
          'Điểm cuối route không khớp cơ sở xử lý đã chọn.',
        )
      }
      const result = await this.persist(
        transaction,
        workItemId,
        input,
        selected,
        providerResult,
        context,
        { code: `R-${randomUUID().slice(0, 8).toUpperCase()}`, version: 1 },
        ownerId,
      )
      await this.audit.append(transaction, {
        action: 'created',
        actorId: ownerId,
        afterData: {
          distanceOneWayM: result.distanceOneWayM,
          id: result.id,
          measurementId: result.measurement.id,
          provider: result.provider,
        },
        entityId: result.id,
        entityType: 'transport_route',
        inspectionCaseId: context.caseId,
        traceId,
      })
      return result
    })
  }

  async recalculate(
    routeId: string,
    input: RecalculateTransportRouteRequest,
    ownerId: string,
    traceId: string,
  ) {
    const initial = await this.repository.getStoredContext(this.database, routeId, ownerId)
    if (!initial) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Không tìm thấy route.')
    const providerResult = await this.callProvider(initial.request, ownerId)
    const selected = this.candidate(providerResult, input.candidateIndex ?? 0)
    return this.database.transaction().execute(async (transaction) => {
      const current = await this.repository.getStoredContext(transaction, routeId, ownerId)
      if (!current || current.measurementId !== initial.measurementId)
        throw new AppError(409, 'ROUTE_VERSION_CONFLICT', 'Route đã thay đổi trong lúc tính lại.')
      const context = this.requireContext(
        await this.measurements.getWorkContext(transaction, current.workItemId, ownerId),
      )
      if (!(await this.measurements.markSuperseded(transaction, current.measurementId)))
        throw new AppError(
          409,
          'ROUTE_NOT_CONFIRMED',
          'Chỉ route hiện hành đã xác nhận mới được tính lại.',
        )
      const saveInput: SaveTransportRouteRequest = {
        name: current.name,
        request: current.request,
        candidateIndex: input.candidateIndex ?? 0,
        returnFactor: current.returnFactor,
        tripCount: current.tripCount,
        ...(current.transportedWeightTon === null
          ? {}
          : { transportedWeightTon: current.transportedWeightTon }),
        ...(current.treatmentFacilityId
          ? { treatmentFacilityId: current.treatmentFacilityId }
          : {}),
        note: current.note,
      }
      const result = await this.persist(
        transaction,
        current.workItemId,
        saveInput,
        selected,
        providerResult,
        context,
        { code: current.code, version: current.version + 1, supersedesId: current.measurementId },
        ownerId,
      )
      await this.audit.append(transaction, {
        action: 'superseded',
        actorId: ownerId,
        beforeData: { measurementId: current.measurementId, routeId, version: current.version },
        afterData: {
          measurementId: result.measurement.id,
          routeId: result.id,
          version: result.measurement.version,
        },
        entityId: result.id,
        entityType: 'transport_route',
        inspectionCaseId: context.caseId,
        reason: input.reason,
        traceId,
      })
      return result
    })
  }

  weighted(input: WeightedDistanceRequest) {
    return weightedDistance(input.routes)
  }
}
