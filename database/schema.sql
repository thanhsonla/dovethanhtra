-- Bootstrap schema for MVP v1. Production work should convert this file into
-- ordered migrations and add ownership/RLS decisions before deployment.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE case_status AS ENUM ('draft', 'in_progress', 'review', 'locked', 'archived');
CREATE TYPE work_item_status AS ENUM ('draft', 'active', 'completed', 'archived');
CREATE TYPE measurement_status AS ENUM (
  'draft', 'pending_validation', 'needs_attention', 'confirmed', 'superseded', 'deleted'
);
CREATE TYPE measurement_method AS ENUM (
  'map_draw', 'gps_point', 'gps_track', 'route_provider', 'import_geojson', 'manual_document'
);
CREATE TYPE measurement_kind AS ENUM ('count', 'point', 'line', 'area', 'route', 'composite');
CREATE TYPE source_quantity_kind AS ENUM ('estimate', 'contract', 'reported', 'accepted', 'other');

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_area (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  area_type text NOT NULL,
  parent_id uuid REFERENCES admin_area(id),
  valid_from date NOT NULL,
  valid_to date,
  boundary geometry(MultiPolygon, 4326) NOT NULL,
  source text,
  source_version text NOT NULL,
  source_hash char(64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_area_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT admin_area_boundary_valid CHECK (ST_IsValid(boundary)),
  CONSTRAINT admin_area_source_hash_format CHECK (
    source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'
  ),
  UNIQUE (code, source_version)
);

CREATE TABLE inspection_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code text NOT NULL UNIQUE,
  name text NOT NULL,
  admin_area_id uuid NOT NULL REFERENCES admin_area(id),
  boundary_snapshot geometry(MultiPolygon, 4326) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  inspected_entity text,
  description text,
  status case_status NOT NULL DEFAULT 'draft',
  owner_id uuid NOT NULL REFERENCES app_user(id),
  locked_at timestamptz,
  locked_by uuid REFERENCES app_user(id),
  lock_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT inspection_case_dates CHECK (period_end >= period_start),
  CONSTRAINT inspection_case_boundary_valid CHECK (ST_IsValid(boundary_snapshot)),
  CONSTRAINT inspection_case_lock_consistency CHECK (
    (status = 'locked' AND locked_at IS NOT NULL AND locked_by IS NOT NULL)
    OR status <> 'locked'
  )
);

CREATE TABLE service_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  color text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE work_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_group_id uuid NOT NULL REFERENCES service_group(id),
  code text NOT NULL,
  name text NOT NULL,
  measurement_kind measurement_kind NOT NULL,
  base_unit text NOT NULL,
  attribute_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_spec jsonb NOT NULL,
  calculation_version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_type_calculation_version CHECK (calculation_version > 0),
  UNIQUE (code, calculation_version)
);

CREATE TABLE case_work_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_case_id uuid NOT NULL REFERENCES inspection_case(id),
  work_type_id uuid NOT NULL REFERENCES work_type(id),
  name text NOT NULL,
  period_start date,
  period_end date,
  unit text NOT NULL,
  formula_snapshot jsonb NOT NULL,
  warning_threshold jsonb NOT NULL DEFAULT '{}'::jsonb,
  status work_item_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT case_work_item_dates CHECK (
    period_start IS NULL OR period_end IS NULL OR period_end >= period_start
  )
);

CREATE TABLE measurement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_work_item_id uuid NOT NULL REFERENCES case_work_item(id),
  code text NOT NULL,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES measurement(id),
  method measurement_method NOT NULL,
  geometry_kind measurement_kind NOT NULL,
  raw_geometry geometry(Geometry, 4326),
  normalized_geometry geometry(Geometry, 4326),
  source_device text,
  source_provider text,
  captured_at timestamptz,
  gps_accuracy_m numeric(12, 3),
  base_value numeric(24, 8),
  calculated_quantity numeric(24, 8),
  unit text NOT NULL,
  calculation_rule_code text NOT NULL,
  calculation_version integer NOT NULL,
  calculation_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL DEFAULT 'pending',
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  status measurement_status NOT NULL DEFAULT 'draft',
  note text,
  created_by uuid NOT NULL REFERENCES app_user(id),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT measurement_version CHECK (version > 0),
  CONSTRAINT measurement_quantity_nonnegative CHECK (
    calculated_quantity IS NULL OR calculated_quantity >= 0
  ),
  CONSTRAINT measurement_accuracy_nonnegative CHECK (
    gps_accuracy_m IS NULL OR gps_accuracy_m >= 0
  ),
  CONSTRAINT measurement_geometry_required CHECK (
    geometry_kind IN ('count', 'composite') OR raw_geometry IS NOT NULL
  ),
  CONSTRAINT measurement_normalized_geometry_valid CHECK (
    normalized_geometry IS NULL OR ST_IsValid(normalized_geometry)
  ),
  CONSTRAINT measurement_confirmation_consistency CHECK (
    (status = 'confirmed' AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL)
    OR status <> 'confirmed'
  ),
  UNIQUE (case_work_item_id, code, version)
);

CREATE TABLE treatment_facility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  facility_type text NOT NULL,
  admin_area_id uuid REFERENCES admin_area(id),
  location geometry(Point, 4326) NOT NULL,
  address text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transport_route (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL UNIQUE REFERENCES measurement(id),
  route_source text NOT NULL CHECK (
    route_source IN ('drawn', 'routed', 'gps_track', 'manual_document')
  ),
  provider text,
  profile text,
  origin geometry(Point, 4326) NOT NULL,
  destination geometry(Point, 4326) NOT NULL,
  treatment_facility_id uuid REFERENCES treatment_facility(id),
  waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  legs jsonb NOT NULL DEFAULT '[]'::jsonb,
  route_geometry geometry(LineString, 4326) NOT NULL,
  distance_one_way_m numeric(24, 8) NOT NULL CHECK (distance_one_way_m >= 0),
  duration_s numeric(24, 3) CHECK (duration_s IS NULL OR duration_s >= 0),
  return_factor numeric(12, 4) NOT NULL DEFAULT 1 CHECK (return_factor >= 0),
  trip_count numeric(16, 4) NOT NULL DEFAULT 1 CHECK (trip_count >= 0),
  transported_weight_ton numeric(24, 8) CHECK (
    transported_weight_ton IS NULL OR transported_weight_ton >= 0
  ),
  vehicle_km numeric(24, 8),
  ton_km numeric(24, 8),
  request_fingerprint text,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_quantity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_work_item_id uuid NOT NULL REFERENCES case_work_item(id),
  source_kind source_quantity_kind NOT NULL,
  document_no text,
  document_date date,
  quantity numeric(24, 8) NOT NULL,
  unit text NOT NULL,
  period_start date,
  period_end date,
  note text,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT source_quantity_nonnegative CHECK (quantity >= 0),
  CONSTRAINT source_quantity_dates CHECK (
    period_start IS NULL OR period_end IS NULL OR period_end >= period_start
  )
);

CREATE TABLE attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid REFERENCES measurement(id),
  case_work_item_id uuid REFERENCES case_work_item(id),
  object_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256 text NOT NULL,
  captured_at timestamptz,
  captured_location geometry(Point, 4326),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT attachment_parent CHECK (
    measurement_id IS NOT NULL OR case_work_item_id IS NOT NULL
  )
);

CREATE TABLE audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_case_id uuid REFERENCES inspection_case(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL REFERENCES app_user(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  before_data jsonb,
  after_data jsonb,
  trace_id text NOT NULL
);

CREATE TABLE sync_mutation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  device_id text NOT NULL,
  entity_type text NOT NULL,
  entity_local_id text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'succeeded', 'failed', 'conflict')),
  server_entity_id uuid,
  response_summary jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, idempotency_key)
);

CREATE TABLE case_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_case_id uuid NOT NULL REFERENCES inspection_case(id),
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('lock', 'export')),
  snapshot_hash text NOT NULL,
  summary jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_area_boundary_gix ON admin_area USING gist (boundary);
CREATE INDEX inspection_case_boundary_gix ON inspection_case USING gist (boundary_snapshot);
CREATE INDEX measurement_raw_geometry_gix ON measurement USING gist (raw_geometry);
CREATE INDEX measurement_normalized_geometry_gix ON measurement USING gist (normalized_geometry);
CREATE UNIQUE INDEX measurement_current_code_uidx
  ON measurement (case_work_item_id, code)
  WHERE status NOT IN ('superseded', 'deleted') AND deleted_at IS NULL;
CREATE INDEX transport_route_geometry_gix ON transport_route USING gist (route_geometry);
CREATE INDEX treatment_facility_location_gix ON treatment_facility USING gist (location);
CREATE INDEX measurement_work_item_idx ON measurement (case_work_item_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX work_item_case_idx ON case_work_item (inspection_case_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX source_quantity_work_item_idx ON source_quantity (case_work_item_id, source_kind)
  WHERE deleted_at IS NULL;
CREATE INDEX audit_case_time_idx ON audit_event (inspection_case_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_user_updated_at BEFORE UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER inspection_case_updated_at BEFORE UPDATE ON inspection_case
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER service_group_updated_at BEFORE UPDATE ON service_group
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER work_type_updated_at BEFORE UPDATE ON work_type
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER case_work_item_updated_at BEFORE UPDATE ON case_work_item
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER measurement_updated_at BEFORE UPDATE ON measurement
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER treatment_facility_updated_at BEFORE UPDATE ON treatment_facility
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER source_quantity_updated_at BEFORE UPDATE ON source_quantity
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
