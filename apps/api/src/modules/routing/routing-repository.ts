import type { RouteLeg, RoutePosition, RouteRequest, TreatmentFacility } from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'

export interface StoredRouteContext {
  caseId: string
  caseStatus: string
  code: string
  formulaSnapshot: { calculationSpec?: { ruleCode?: string }; calculationVersion?: number }
  measurementId: string
  name: string
  note: string | null
  request: RouteRequest
  returnFactor: number
  tripCount: number
  transportedWeightTon: number | null
  treatmentFacilityId: string | null
  version: number
  workItemId: string
}

export interface InsertRouteInput {
  calculatedAt: string
  destination: RoutePosition
  distanceM: number
  durationS: number
  fingerprint: string
  geometry: { type: string; coordinates: unknown }
  legs: RouteLeg[]
  measurementId: string
  metadata: Record<string, unknown>
  origin: RoutePosition
  profile: string
  provider: string
  request: RouteRequest
  returnFactor: number
  treatmentFacilityId?: string
  tonKm: number | null
  transportedWeightTon?: number
  tripCount: number
  vehicleKm: number
  waypoints: RoutePosition[]
}

export class RoutingRepository {
  constructor(private readonly database: AppDatabase) {}

  async listFacilities(ownerId: string): Promise<TreatmentFacility[]> {
    const result = await sql<TreatmentFacility>`
      SELECT id, code, name, facility_type AS "facilityType",
        ARRAY[ST_X(location), ST_Y(location)]::float8[] AS location,
        address, active FROM treatment_facility
      WHERE deleted_at IS NULL AND (active OR created_by = ${ownerId}::uuid)
      ORDER BY name LIMIT 500
    `.execute(this.database)
    return result.rows
  }

  async createFacility(
    executor: QueryExecutor,
    input: Omit<TreatmentFacility, 'id' | 'active'>,
    actorId: string,
  ): Promise<TreatmentFacility> {
    const result = await sql<TreatmentFacility>`
      INSERT INTO treatment_facility (code, name, facility_type, location, address, created_by)
      VALUES (${input.code}, ${input.name}, ${input.facilityType},
        ST_SetSRID(ST_MakePoint(${input.location[0]}, ${input.location[1]}), 4326),
        ${input.address}, ${actorId}::uuid)
      RETURNING id, code, name, facility_type AS "facilityType",
        ARRAY[ST_X(location), ST_Y(location)]::float8[] AS location, address, active
    `.execute(executor)
    return result.rows[0]!
  }

  async facilityMatchesDestination(
    executor: QueryExecutor,
    facilityId: string,
    destination: RoutePosition,
  ): Promise<boolean> {
    const result = await sql<{ matches: boolean }>`
      SELECT ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${destination[0]}, ${destination[1]}), 4326)::geography,
        50
      ) AS matches
      FROM treatment_facility
      WHERE id = ${facilityId}::uuid AND active AND deleted_at IS NULL
    `.execute(executor)
    return result.rows[0]?.matches === true
  }

  async insertRoute(executor: QueryExecutor, input: InsertRouteInput): Promise<string> {
    const result = await sql<{ id: string }>`
      INSERT INTO transport_route (
        measurement_id, provider, profile, origin, destination, treatment_facility_id,
        waypoints, legs, route_geometry, distance_one_way_m, duration_s, return_factor,
        trip_count, transported_weight_ton, vehicle_km, ton_km, route_request,
        request_fingerprint, provider_metadata, calculated_at
      ) VALUES (
        ${input.measurementId}::uuid, ${input.provider}, ${input.profile},
        ST_SetSRID(ST_MakePoint(${input.origin[0]}, ${input.origin[1]}), 4326),
        ST_SetSRID(ST_MakePoint(${input.destination[0]}, ${input.destination[1]}), 4326),
        ${input.treatmentFacilityId ?? null}::uuid, ${JSON.stringify(input.waypoints)}::jsonb,
        ${JSON.stringify(input.legs)}::jsonb,
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(input.geometry)}), 4326),
        ${input.distanceM}, ${input.durationS}, ${input.returnFactor}, ${input.tripCount},
        ${input.transportedWeightTon ?? null}, ${input.vehicleKm}, ${input.tonKm},
        ${JSON.stringify(input.request)}::jsonb, ${input.fingerprint},
        ${JSON.stringify(input.metadata)}::jsonb, ${input.calculatedAt}::timestamptz
      ) RETURNING id
    `.execute(executor)
    return result.rows[0]!.id
  }

  async linkRoute(executor: QueryExecutor, measurementId: string, routeId: string): Promise<void> {
    await sql`
      UPDATE measurement SET calculation_output = calculation_output ||
        jsonb_build_object('routeId', ${routeId}::text)
      WHERE id = ${measurementId}::uuid
    `.execute(executor)
  }

  async getStoredContext(
    executor: QueryExecutor,
    routeId: string,
    ownerId: string,
  ): Promise<StoredRouteContext | null> {
    const result = await sql<StoredRouteContext>`
      SELECT c.id AS "caseId", c.status AS "caseStatus", m.id AS "measurementId",
        m.case_work_item_id AS "workItemId", m.code, m.name, m.version, m.note,
        w.formula_snapshot AS "formulaSnapshot", r.route_request AS request,
        r.return_factor AS "returnFactor", r.trip_count AS "tripCount",
        r.transported_weight_ton AS "transportedWeightTon",
        r.treatment_facility_id AS "treatmentFacilityId"
      FROM transport_route r JOIN measurement m ON m.id = r.measurement_id
      JOIN case_work_item w ON w.id = m.case_work_item_id
      JOIN inspection_case c ON c.id = w.inspection_case_id
      WHERE r.id = ${routeId}::uuid AND c.owner_id = ${ownerId}::uuid
        AND m.deleted_at IS NULL AND c.deleted_at IS NULL AND w.deleted_at IS NULL
    `.execute(executor)
    const row = result.rows[0]
    return row
      ? {
          ...row,
          returnFactor: Number(row.returnFactor),
          tripCount: Number(row.tripCount),
          transportedWeightTon:
            row.transportedWeightTon === null ? null : Number(row.transportedWeightTon),
        }
      : null
  }

  async getRouteIdByMeasurement(executor: QueryExecutor, measurementId: string): Promise<string> {
    const result = await sql<{
      id: string
    }>`SELECT id FROM transport_route WHERE measurement_id = ${measurementId}::uuid`.execute(
      executor,
    )
    return result.rows[0]!.id
  }
}
