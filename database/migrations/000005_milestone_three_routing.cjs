/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE measurement DROP CONSTRAINT measurement_kind_m2;
    ALTER TABLE measurement ADD CONSTRAINT measurement_kind_m3
      CHECK (geometry_kind IN ('point', 'line', 'area', 'route'));

    CREATE TABLE treatment_facility (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
      name text NOT NULL, facility_type text NOT NULL CHECK (facility_type IN (
        'collection_point', 'transfer_station', 'treatment_facility', 'depot'
      )), admin_area_id uuid REFERENCES admin_area(id),
      location geometry(Point, 4326) NOT NULL, address text,
      active boolean NOT NULL DEFAULT true, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by uuid NOT NULL REFERENCES app_user(id), created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    );
    CREATE INDEX treatment_facility_location_gix ON treatment_facility USING gist (location);
    CREATE INDEX treatment_facility_active_idx ON treatment_facility (active, name)
      WHERE deleted_at IS NULL;
    CREATE TRIGGER treatment_facility_updated_at BEFORE UPDATE ON treatment_facility
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TABLE transport_route (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      measurement_id uuid NOT NULL UNIQUE REFERENCES measurement(id),
      route_source text NOT NULL DEFAULT 'routed' CHECK (route_source = 'routed'),
      provider text NOT NULL, profile text NOT NULL CHECK (profile IN ('driving', 'driving-traffic')),
      origin geometry(Point, 4326) NOT NULL, destination geometry(Point, 4326) NOT NULL,
      treatment_facility_id uuid REFERENCES treatment_facility(id),
      waypoints jsonb NOT NULL DEFAULT '[]'::jsonb, legs jsonb NOT NULL DEFAULT '[]'::jsonb,
      route_geometry geometry(LineString, 4326) NOT NULL,
      distance_one_way_m numeric(24, 8) NOT NULL CHECK (distance_one_way_m >= 0),
      duration_s numeric(24, 3) NOT NULL CHECK (duration_s >= 0),
      return_factor numeric(12, 4) NOT NULL CHECK (return_factor >= 0),
      trip_count numeric(16, 4) NOT NULL CHECK (trip_count >= 0),
      transported_weight_ton numeric(24, 8) CHECK (transported_weight_ton >= 0),
      vehicle_km numeric(24, 8) NOT NULL CHECK (vehicle_km >= 0),
      ton_km numeric(24, 8) CHECK (ton_km >= 0), route_request jsonb NOT NULL,
      request_fingerprint char(64) NOT NULL, provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      calculated_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX transport_route_geometry_gix ON transport_route USING gist (route_geometry);
    CREATE INDEX transport_route_facility_idx ON transport_route (treatment_facility_id);
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM transport_route LIMIT 1) THEN
        RAISE EXCEPTION 'Refusing M3 rollback: transport_route contains evidence';
      END IF;
    END $$;
    DROP TABLE IF EXISTS transport_route;
    DROP TABLE IF EXISTS treatment_facility;
    ALTER TABLE measurement DROP CONSTRAINT measurement_kind_m3;
    ALTER TABLE measurement ADD CONSTRAINT measurement_kind_m2
      CHECK (geometry_kind IN ('point', 'line', 'area')) NOT VALID;
  `)
}
