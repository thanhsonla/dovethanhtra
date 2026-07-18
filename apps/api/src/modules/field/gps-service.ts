import { createHash, randomUUID } from 'node:crypto'

import type {
  CreateGpsPointRequest,
  CreateGpsTrackRequest,
  GeoJsonGeometry,
  GpsPoint,
  GpsPointResponse,
  GpsTrackResponse,
  MeasurementWarning,
} from '@dove/contracts'
import { sql } from 'kysely'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import { calculateMeasurement } from '../measurements/calculation-engine.js'
import type { MeasurementRepository } from '../measurements/measurement-repository.js'

interface SyncRow {
  payloadHash: string
  serverEntityId: string | null
  status: string
}

function geometry(segments: GpsPoint[][]): GeoJsonGeometry {
  return {
    type: 'MultiLineString',
    coordinates: segments.map((segment) => segment.map((point) => point.position)),
  }
}

export class GpsService {
  constructor(
    private readonly database: AppDatabase,
    private readonly measurements: MeasurementRepository,
    private readonly audit: AuditRepository,
  ) {}

  private async existing(executor: QueryExecutor, actorId: string, deviceId: string, key: string) {
    const result = await sql<SyncRow>`
      SELECT payload_hash AS "payloadHash", server_entity_id AS "serverEntityId", status
      FROM sync_mutation WHERE actor_id = ${actorId}::uuid AND device_id = ${deviceId}
        AND idempotency_key = ${key}
    `.execute(executor)
    return result.rows[0] ?? null
  }

  async createPoint(
    workItemId: string,
    input: CreateGpsPointRequest,
    ownerId: string,
    deviceId: string,
    idempotencyKey: string,
    traceId: string,
  ): Promise<GpsPointResponse> {
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    return this.database.transaction().execute(async (transaction) => {
      const replay = await this.existing(transaction, ownerId, deviceId, idempotencyKey)
      if (replay) {
        if (replay.payloadHash !== payloadHash)
          throw new AppError(
            409,
            'IDEMPOTENCY_PAYLOAD_CONFLICT',
            'Khóa đồng bộ đã được dùng với dữ liệu khác.',
          )
        if (replay.status !== 'succeeded' || !replay.serverEntityId)
          throw new AppError(
            409,
            'SYNC_MUTATION_IN_PROGRESS',
            'Mutation đang được xử lý; hãy thử lại.',
          )
        const measurement = await this.measurements.get(transaction, replay.serverEntityId, ownerId)
        if (!measurement)
          throw new AppError(409, 'SYNC_RESULT_MISSING', 'Kết quả đồng bộ không còn khả dụng.')
        return { measurement, idempotentReplay: true }
      }
      await sql`
        INSERT INTO sync_mutation (actor_id, idempotency_key, device_id, entity_type,
          entity_local_id, payload_hash, status)
        VALUES (${ownerId}::uuid, ${idempotencyKey}, ${deviceId}, 'gps_point', ${input.localId},
          ${payloadHash}, 'processing')
      `.execute(transaction)
      const context = await this.measurements.getWorkContext(transaction, workItemId, ownerId)
      if (!context) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
      if (context.caseStatus === 'locked')
        throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa; vị trí vẫn được giữ trên thiết bị.')
      if (context.expectedKind !== 'point')
        throw new AppError(422, 'WORK_TYPE_GPS_MISMATCH', 'GPS point chỉ dùng cho công tác điểm.')
      const raw: GeoJsonGeometry = { type: 'Point', coordinates: input.point.position }
      const analysis = await this.measurements.analyzeGeometry(
        transaction,
        workItemId,
        raw,
        'point',
      )
      const calculation = calculateMeasurement(
        analysis.baseValue,
        'point',
        input.calculationInputs ?? {},
        context.formulaSnapshot,
      )
      const warnings: MeasurementWarning[] = [...calculation.warnings]
      if (input.point.accuracyM > input.accuracyThresholdM)
        warnings.push({
          code: 'GPS_ACCURACY_EXCEEDS_THRESHOLD',
          severity: 'warning',
          message: 'Độ chính xác GPS vượt ngưỡng cấu hình.',
          details: { accuracyM: input.point.accuracyM, thresholdM: input.accuracyThresholdM },
        })
      const measurementId = await this.measurements.insert(transaction, {
        baseValue: analysis.baseValue,
        calculatedQuantity: calculation.quantity,
        calculationInputs: input.calculationInputs ?? {},
        calculationOutput: {
          baseValue: analysis.baseValue,
          expression: calculation.expression,
          quantity: calculation.quantity,
          gps: {
            accuracyM: input.point.accuracyM,
            accuracyThresholdM: input.accuracyThresholdM,
            recordedAt: input.point.recordedAt,
          },
        },
        calculationRuleCode: calculation.ruleCode,
        calculationVersion: calculation.calculationVersion,
        code: `P-${randomUUID().slice(0, 8).toUpperCase()}`,
        createdBy: ownerId,
        geometryKind: 'point',
        gpsAccuracyM: input.point.accuracyM,
        method: 'gps_point',
        name: input.name,
        normalizedGeometry: raw,
        note: input.note ?? null,
        rawGeometry: raw,
        status: warnings.length ? 'needs_attention' : 'draft',
        unit: context.unit,
        validationStatus: warnings.some((warning) => warning.severity === 'error')
          ? 'invalid'
          : warnings.length
            ? 'needs_attention'
            : 'valid',
        version: 1,
        warnings,
        workItemId,
      })
      await this.insertPoints(transaction, measurementId, [[input.point]], input.accuracyThresholdM)
      await sql`UPDATE sync_mutation SET status = 'succeeded', server_entity_id = ${measurementId}::uuid,
        response_summary = ${JSON.stringify({ accuracyM: input.point.accuracyM })}::jsonb,
        processed_at = now() WHERE actor_id = ${ownerId}::uuid AND device_id = ${deviceId}
        AND idempotency_key = ${idempotencyKey}`.execute(transaction)
      const measurement = await this.measurements.get(transaction, measurementId, ownerId)
      if (!measurement)
        throw new AppError(500, 'GPS_CREATE_FAILED', 'Không thể đọc GPS point vừa lưu.')
      await this.audit.append(transaction, {
        action: 'created',
        actorId: ownerId,
        afterData: { id: measurementId, method: 'gps_point', accuracyM: input.point.accuracyM },
        entityId: measurementId,
        entityType: 'measurement',
        inspectionCaseId: context.caseId,
        traceId,
      })
      return { measurement, idempotentReplay: false }
    })
  }

  async create(
    workItemId: string,
    input: CreateGpsTrackRequest,
    ownerId: string,
    deviceId: string,
    idempotencyKey: string,
    traceId: string,
  ): Promise<GpsTrackResponse> {
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    return this.database.transaction().execute(async (transaction) => {
      const replay = await this.existing(transaction, ownerId, deviceId, idempotencyKey)
      if (replay) {
        if (replay.payloadHash !== payloadHash)
          throw new AppError(
            409,
            'IDEMPOTENCY_PAYLOAD_CONFLICT',
            'Khóa đồng bộ đã được dùng với dữ liệu khác.',
          )
        if (replay.status !== 'succeeded' || !replay.serverEntityId)
          throw new AppError(
            409,
            'SYNC_MUTATION_IN_PROGRESS',
            'Mutation đang được xử lý; hãy thử lại.',
          )
        const measurement = await this.measurements.get(transaction, replay.serverEntityId, ownerId)
        if (!measurement)
          throw new AppError(409, 'SYNC_RESULT_MISSING', 'Kết quả đồng bộ không còn khả dụng.')
        const counts = measurement.calculationOutput.gps as {
          rawPointCount: number
          normalizedPointCount: number
          segmentCount: number
        }
        return { measurement, ...counts, idempotentReplay: true }
      }
      await sql`
        INSERT INTO sync_mutation (actor_id, idempotency_key, device_id, entity_type,
          entity_local_id, payload_hash, status)
        VALUES (${ownerId}::uuid, ${idempotencyKey}, ${deviceId}, 'gps_track', ${input.localId},
          ${payloadHash}, 'processing')
      `.execute(transaction)
      const context = await this.measurements.getWorkContext(transaction, workItemId, ownerId)
      if (!context) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
      if (context.caseStatus === 'locked')
        throw new AppError(
          423,
          'CASE_LOCKED',
          'Hồ sơ đã khóa; bản nháp vẫn được giữ trên thiết bị.',
        )
      if (context.expectedKind !== 'line')
        throw new AppError(422, 'WORK_TYPE_GPS_MISMATCH', 'GPS track chỉ dùng cho công tác tuyến.')
      const raw = geometry(input.segments)
      const acceptedSegments = input.segments
        .map((segment) => segment.filter((point) => point.accuracyM <= input.accuracyThresholdM))
        .filter((segment) => segment.length >= 2)
      if (!acceptedSegments.length)
        throw new AppError(
          422,
          'GPS_NORMALIZED_EMPTY',
          'Không đủ điểm đạt ngưỡng accuracy để tạo tuyến chuẩn hóa.',
        )
      const normalized = geometry(acceptedSegments)
      const analysis = await this.measurements.analyzeGeometry(
        transaction,
        workItemId,
        normalized,
        'line',
      )
      const calculation = calculateMeasurement(
        analysis.baseValue,
        'line',
        input.calculationInputs ?? {},
        context.formulaSnapshot,
      )
      const rawPointCount = input.segments.reduce((sum, segment) => sum + segment.length, 0)
      const normalizedPointCount = acceptedSegments.reduce(
        (sum, segment) => sum + segment.length,
        0,
      )
      const warnings: MeasurementWarning[] = [...calculation.warnings]
      if (normalizedPointCount < rawPointCount)
        warnings.push({
          code: 'GPS_POINTS_EXCLUDED_BY_ACCURACY',
          severity: 'warning',
          message: 'Một số điểm accuracy thấp chỉ được giữ trong dữ liệu raw.',
          details: {
            excluded: rawPointCount - normalizedPointCount,
            thresholdM: input.accuracyThresholdM,
          },
        })
      const measurementId = await this.measurements.insert(transaction, {
        baseValue: analysis.baseValue,
        calculatedQuantity: calculation.quantity,
        calculationInputs: input.calculationInputs ?? {},
        calculationOutput: {
          baseValue: analysis.baseValue,
          expression: calculation.expression,
          quantity: calculation.quantity,
          gps: {
            rawPointCount,
            normalizedPointCount,
            segmentCount: input.segments.length,
            accuracyThresholdM: input.accuracyThresholdM,
            normalizationVersion: 1,
          },
        },
        calculationRuleCode: calculation.ruleCode,
        calculationVersion: calculation.calculationVersion,
        code: `G-${randomUUID().slice(0, 8).toUpperCase()}`,
        createdBy: ownerId,
        geometryKind: 'line',
        method: 'gps_track',
        name: input.name,
        normalizedGeometry: normalized,
        note: input.note ?? null,
        rawGeometry: raw,
        status: warnings.length ? 'needs_attention' : 'draft',
        unit: context.unit,
        validationStatus: warnings.some((warning) => warning.severity === 'error')
          ? 'invalid'
          : warnings.length
            ? 'needs_attention'
            : 'valid',
        version: 1,
        warnings,
        workItemId,
      })
      await this.insertPoints(transaction, measurementId, input.segments, input.accuracyThresholdM)
      await sql`UPDATE sync_mutation SET status = 'succeeded', server_entity_id = ${measurementId}::uuid,
        response_summary = ${JSON.stringify({ rawPointCount, normalizedPointCount })}::jsonb,
        processed_at = now() WHERE actor_id = ${ownerId}::uuid AND device_id = ${deviceId}
        AND idempotency_key = ${idempotencyKey}`.execute(transaction)
      const measurement = await this.measurements.get(transaction, measurementId, ownerId)
      if (!measurement)
        throw new AppError(500, 'GPS_CREATE_FAILED', 'Không thể đọc GPS track vừa lưu.')
      await this.audit.append(transaction, {
        action: 'created',
        actorId: ownerId,
        afterData: { id: measurementId, method: 'gps_track', rawPointCount, normalizedPointCount },
        entityId: measurementId,
        entityType: 'measurement',
        inspectionCaseId: context.caseId,
        traceId,
      })
      return {
        measurement,
        rawPointCount,
        normalizedPointCount,
        segmentCount: input.segments.length,
        idempotentReplay: false,
      }
    })
  }

  private async insertPoints(
    executor: QueryExecutor,
    measurementId: string,
    segments: GpsPoint[][],
    threshold: number,
  ) {
    for (const [segmentIndex, segment] of segments.entries()) {
      for (const [pointIndex, point] of segment.entries()) {
        await sql`INSERT INTO gps_track_point (measurement_id, segment_index, point_index,
          position, recorded_at, accuracy_m, altitude_m, speed_mps, accepted_for_normalized)
        VALUES (${measurementId}::uuid, ${segmentIndex}, ${pointIndex},
          ST_SetSRID(ST_MakePoint(${point.position[0]}, ${point.position[1]}), 4326),
          ${point.recordedAt}::timestamptz, ${point.accuracyM}, ${point.altitudeM ?? null},
          ${point.speedMps ?? null}, ${point.accuracyM <= threshold})`.execute(executor)
      }
    }
  }
}
