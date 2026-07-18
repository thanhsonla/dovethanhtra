/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE measurement_status AS ENUM (
      'draft', 'pending_validation', 'needs_attention', 'confirmed', 'superseded', 'deleted'
    );
    CREATE TYPE measurement_method AS ENUM (
      'map_draw', 'gps_point', 'gps_track', 'route_provider', 'import_geojson', 'manual_document'
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
      raw_geometry geometry(Geometry, 4326) NOT NULL,
      normalized_geometry geometry(Geometry, 4326),
      base_value numeric(24, 8),
      calculated_quantity numeric(24, 8),
      unit text NOT NULL,
      calculation_rule_code text NOT NULL,
      calculation_version integer NOT NULL,
      calculation_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
      calculation_output jsonb NOT NULL DEFAULT '{}'::jsonb,
      validation_status text NOT NULL,
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
      CONSTRAINT measurement_kind_m2 CHECK (geometry_kind IN ('point', 'line', 'area')),
      CONSTRAINT measurement_validation_status CHECK (
        validation_status IN ('valid', 'invalid', 'needs_attention')
      ),
      CONSTRAINT measurement_quantity_nonnegative CHECK (
        calculated_quantity IS NULL OR calculated_quantity >= 0
      ),
      CONSTRAINT measurement_base_nonnegative CHECK (base_value IS NULL OR base_value >= 0),
      CONSTRAINT measurement_normalized_valid CHECK (
        normalized_geometry IS NULL OR ST_IsValid(normalized_geometry)
      ),
      CONSTRAINT measurement_confirmation_consistency CHECK (
        (status = 'confirmed' AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL)
        OR status <> 'confirmed'
      ),
      UNIQUE (case_work_item_id, code, version)
    );

    CREATE UNIQUE INDEX measurement_current_code_uidx
      ON measurement (case_work_item_id, code)
      WHERE status NOT IN ('superseded', 'deleted') AND deleted_at IS NULL;
    CREATE INDEX measurement_work_item_idx
      ON measurement (case_work_item_id, status, created_at DESC)
      WHERE deleted_at IS NULL;
    CREATE INDEX measurement_supersedes_idx ON measurement (supersedes_id);
    CREATE INDEX measurement_normalized_gix ON measurement USING gist (normalized_geometry);

    CREATE TRIGGER measurement_updated_at BEFORE UPDATE ON measurement
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS measurement;
    DROP TYPE IF EXISTS measurement_method;
    DROP TYPE IF EXISTS measurement_status;
  `)
}
