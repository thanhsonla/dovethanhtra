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
CREATE TYPE capture_draft_status AS ENUM (
  'unclassified', 'classifying', 'classified', 'conflict', 'deleted'
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
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
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
  warning_threshold jsonb NOT NULL DEFAULT '{}'::jsonb,
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
  quick_default boolean NOT NULL DEFAULT false,
  quick_label text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT service_group_quick_label CHECK (
    NOT quick_default OR length(btrim(quick_label)) > 0
  )
);

-- Nhãn phân loại nghiệp vụ, không phải địa giới và cố ý không có geometry.
CREATE TABLE management_zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]+$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  system_seed boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT management_zone_delete_state CHECK (
    (deleted_at IS NULL AND active) OR (deleted_at IS NOT NULL AND NOT active)
  )
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
  management_zone_id uuid REFERENCES management_zone(id),
  service_group_id uuid NOT NULL REFERENCES service_group(id),
  work_type_id uuid REFERENCES work_type(id),
  measurement_kind measurement_kind NOT NULL,
  name text NOT NULL,
  period_start date,
  period_end date,
  unit text NOT NULL,
  formula_snapshot jsonb NOT NULL,
  warning_threshold jsonb NOT NULL DEFAULT '{}'::jsonb,
  status work_item_status NOT NULL DEFAULT 'draft',
  status_before_delete work_item_status,
  status_before_delete work_item_status,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT case_work_item_dates CHECK (
    period_start IS NULL OR period_end IS NULL OR period_end >= period_start
  )
);

CREATE TABLE work_component (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_work_item_id uuid NOT NULL REFERENCES case_work_item(id),
  name text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  status work_item_status NOT NULL DEFAULT 'draft',
  status_before_delete work_item_status,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT work_component_delete_state CHECK (
    deleted_at IS NULL OR status = 'archived'
  )
);

CREATE TABLE capture_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_case_id uuid NOT NULL REFERENCES inspection_case(id),
  local_id text NOT NULL,
  device_id text NOT NULL,
  idempotency_key text NOT NULL,
  payload_hash char(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  classification_idempotency_key text,
  classification_payload_hash char(64),
  geometry_kind measurement_kind NOT NULL CHECK (geometry_kind IN ('point', 'line', 'area')),
  method measurement_method NOT NULL DEFAULT 'map_draw',
  raw_geometry geometry(Geometry, 4326) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status capture_draft_status NOT NULL DEFAULT 'unclassified',
  status_before_delete capture_draft_status,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  classified_measurement_id uuid UNIQUE,
  created_by uuid NOT NULL REFERENCES app_user(id),
  classified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT capture_draft_classification_identity CHECK (
    (classification_idempotency_key IS NULL AND classification_payload_hash IS NULL)
    OR (
      length(btrim(classification_idempotency_key)) > 0
      AND classification_payload_hash ~ '^[0-9a-f]{64}$'
    )
  ),
  UNIQUE (created_by, device_id, local_id),
  UNIQUE (created_by, device_id, idempotency_key)
);

CREATE TABLE measurement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_work_item_id uuid NOT NULL REFERENCES case_work_item(id),
  work_component_id uuid REFERENCES work_component(id),
  capture_draft_id uuid UNIQUE REFERENCES capture_draft(id),
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

ALTER TABLE capture_draft
  ADD CONSTRAINT capture_draft_classified_measurement_fk
  FOREIGN KEY (classified_measurement_id) REFERENCES measurement(id);

CREATE TABLE treatment_facility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  facility_type text NOT NULL,
  admin_area_id uuid REFERENCES admin_area(id),
  location geometry(Point, 4326) NOT NULL,
  address text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE gps_track_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES measurement(id),
  segment_index integer NOT NULL,
  point_index integer NOT NULL,
  position geometry(Point, 4326) NOT NULL,
  recorded_at timestamptz NOT NULL,
  accuracy_m numeric(12, 3) NOT NULL CHECK (accuracy_m >= 0),
  altitude_m numeric(12, 3),
  speed_mps numeric(12, 3),
  accepted_for_normalized boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (measurement_id, segment_index, point_index)
);

CREATE TABLE transport_route (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL UNIQUE REFERENCES measurement(id),
  route_source text NOT NULL CHECK (
    route_source IN ('drawn', 'routed', 'gps_track', 'manual_document')
  ),
  provider text NOT NULL,
  profile text NOT NULL,
  origin geometry(Point, 4326) NOT NULL,
  destination geometry(Point, 4326) NOT NULL,
  treatment_facility_id uuid REFERENCES treatment_facility(id),
  waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  legs jsonb NOT NULL DEFAULT '[]'::jsonb,
  route_geometry geometry(LineString, 4326) NOT NULL,
  distance_one_way_m numeric(24, 8) NOT NULL CHECK (distance_one_way_m >= 0),
  duration_s numeric(24, 3) NOT NULL CHECK (duration_s >= 0),
  return_factor numeric(12, 4) NOT NULL DEFAULT 1 CHECK (return_factor >= 0),
  trip_count numeric(16, 4) NOT NULL DEFAULT 1 CHECK (trip_count >= 0),
  transported_weight_ton numeric(24, 8) CHECK (
    transported_weight_ton IS NULL OR transported_weight_ton >= 0
  ),
  vehicle_km numeric(24, 8),
  ton_km numeric(24, 8),
  route_request jsonb NOT NULL,
  request_fingerprint text NOT NULL,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid REFERENCES measurement(id),
  case_work_item_id uuid REFERENCES case_work_item(id),
  object_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  expected_size_bytes bigint NOT NULL CHECK (expected_size_bytes > 0),
  size_bytes bigint CHECK (size_bytes > 0),
  expected_sha256 char(64) NOT NULL,
  sha256 char(64),
  upload_status text NOT NULL CHECK (upload_status IN ('pending', 'completed', 'failed')),
  captured_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT attachment_parent CHECK (
    num_nonnulls(measurement_id, case_work_item_id) = 1
  ),
  CONSTRAINT attachment_mime_type CHECK (
    mime_type IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  CONSTRAINT attachment_expected_sha256_hex CHECK (
    expected_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT attachment_sha256_hex CHECK (
    sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT attachment_completion CHECK (
    (upload_status = 'completed' AND size_bytes IS NOT NULL AND sha256 IS NOT NULL AND completed_at IS NOT NULL)
    OR upload_status <> 'completed'
  )
);

CREATE TABLE source_quantity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_work_item_id uuid NOT NULL REFERENCES case_work_item(id),
  source_kind source_quantity_kind NOT NULL,
  document_no text,
  document_date date,
  quantity numeric(24, 8) NOT NULL CHECK (quantity >= 0),
  unit text NOT NULL,
  period_start date,
  period_end date,
  note text,
  attachment_id uuid REFERENCES attachment(id),
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT source_quantity_dates CHECK (
    period_start IS NULL OR period_end IS NULL OR period_end >= period_start
  )
);

CREATE TABLE comparison_explanation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_quantity_id uuid NOT NULL REFERENCES source_quantity(id),
  explanation text NOT NULL CHECK (length(explanation) BETWEEN 3 AND 5000),
  attachment_id uuid REFERENCES attachment(id),
  created_by uuid NOT NULL REFERENCES app_user(id),
  updated_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
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
  actor_id uuid NOT NULL REFERENCES app_user(id),
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
  UNIQUE (actor_id, device_id, idempotency_key)
);

CREATE TABLE case_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_case_id uuid NOT NULL REFERENCES inspection_case(id),
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('lock', 'export')),
  snapshot_hash char(64) NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  summary jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE export_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_case_id uuid NOT NULL REFERENCES inspection_case(id),
  snapshot_id uuid NOT NULL REFERENCES case_snapshot(id),
  format text NOT NULL CHECK (format IN ('xlsx', 'geojson')),
  file_name text NOT NULL,
  file_hash char(64) NOT NULL CHECK (file_hash ~ '^[0-9a-f]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_area_boundary_gix ON admin_area USING gist (boundary);
CREATE INDEX admin_area_management_idx ON admin_area (area_type, valid_from, valid_to)
  WHERE deleted_at IS NULL;
CREATE INDEX service_group_quick_idx ON service_group (display_order, name)
  WHERE quick_default AND active AND deleted_at IS NULL;
CREATE INDEX management_zone_active_idx ON management_zone (display_order, name)
  WHERE deleted_at IS NULL AND active;
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
CREATE INDEX measurement_component_idx ON measurement (work_component_id, status)
  WHERE work_component_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX work_component_work_idx ON work_component (case_work_item_id, display_order)
  WHERE deleted_at IS NULL;
CREATE INDEX capture_draft_case_status_idx
  ON capture_draft (inspection_case_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX capture_draft_geometry_gix ON capture_draft USING gist (raw_geometry);
CREATE UNIQUE INDEX capture_draft_classification_idempotency_uidx
  ON capture_draft (created_by, device_id, classification_idempotency_key)
  WHERE classification_idempotency_key IS NOT NULL;
CREATE INDEX work_item_case_idx ON case_work_item (inspection_case_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX source_quantity_work_item_idx ON source_quantity (case_work_item_id, source_kind)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX comparison_explanation_current_uidx
  ON comparison_explanation (source_quantity_id) WHERE deleted_at IS NULL;
CREATE INDEX case_snapshot_case_idx ON case_snapshot (inspection_case_id, created_at DESC);
CREATE INDEX export_record_case_idx ON export_record (inspection_case_id, created_at DESC);
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
CREATE TRIGGER admin_area_updated_at BEFORE UPDATE ON admin_area
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER service_group_updated_at BEFORE UPDATE ON service_group
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER management_zone_updated_at BEFORE UPDATE ON management_zone
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER work_type_updated_at BEFORE UPDATE ON work_type
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER case_work_item_updated_at BEFORE UPDATE ON case_work_item
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER work_component_updated_at BEFORE UPDATE ON work_component
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER capture_draft_updated_at BEFORE UPDATE ON capture_draft
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER measurement_updated_at BEFORE UPDATE ON measurement
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER treatment_facility_updated_at BEFORE UPDATE ON treatment_facility
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER source_quantity_updated_at BEFORE UPDATE ON source_quantity
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER comparison_explanation_updated_at BEFORE UPDATE ON comparison_explanation
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
