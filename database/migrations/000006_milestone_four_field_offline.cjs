/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE measurement ADD COLUMN gps_accuracy_m numeric(12, 3)
      CHECK (gps_accuracy_m IS NULL OR gps_accuracy_m >= 0);

    CREATE TABLE gps_track_point (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      measurement_id uuid NOT NULL REFERENCES measurement(id),
      segment_index integer NOT NULL CHECK (segment_index >= 0),
      point_index integer NOT NULL CHECK (point_index >= 0),
      position geometry(Point, 4326) NOT NULL,
      recorded_at timestamptz NOT NULL,
      accuracy_m numeric(12, 3) NOT NULL CHECK (accuracy_m >= 0),
      altitude_m numeric(12, 3), speed_mps numeric(12, 3),
      accepted_for_normalized boolean NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (measurement_id, segment_index, point_index)
    );
    CREATE INDEX gps_track_point_position_gix ON gps_track_point USING gist (position);

    CREATE TABLE attachment (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      measurement_id uuid REFERENCES measurement(id),
      case_work_item_id uuid REFERENCES case_work_item(id),
      object_key text NOT NULL UNIQUE, original_name text NOT NULL,
      mime_type text NOT NULL, expected_size_bytes bigint NOT NULL CHECK (expected_size_bytes > 0),
      size_bytes bigint CHECK (size_bytes > 0), expected_sha256 char(64) NOT NULL,
      sha256 char(64), upload_status text NOT NULL DEFAULT 'pending'
        CHECK (upload_status IN ('pending', 'completed', 'failed')),
      captured_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by uuid NOT NULL REFERENCES app_user(id), created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz, deleted_at timestamptz,
      CONSTRAINT attachment_parent CHECK (measurement_id IS NOT NULL OR case_work_item_id IS NOT NULL),
      CONSTRAINT attachment_completion CHECK (
        (upload_status = 'completed' AND size_bytes IS NOT NULL AND sha256 IS NOT NULL AND completed_at IS NOT NULL)
        OR upload_status <> 'completed'
      )
    );
    CREATE INDEX attachment_measurement_idx ON attachment (measurement_id) WHERE deleted_at IS NULL;
    CREATE INDEX attachment_work_item_idx ON attachment (case_work_item_id) WHERE deleted_at IS NULL;

    CREATE TABLE sync_mutation (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES app_user(id),
      idempotency_key text NOT NULL, device_id text NOT NULL, entity_type text NOT NULL,
      entity_local_id text NOT NULL, payload_hash char(64) NOT NULL,
      status text NOT NULL CHECK (status IN ('processing', 'succeeded', 'failed', 'conflict')),
      server_entity_id uuid, response_summary jsonb, processed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (actor_id, device_id, idempotency_key)
    );
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM gps_track_point LIMIT 1)
        OR EXISTS (SELECT 1 FROM attachment LIMIT 1)
        OR EXISTS (SELECT 1 FROM sync_mutation WHERE status = 'succeeded' LIMIT 1) THEN
        RAISE EXCEPTION 'Refusing M4 rollback: field evidence or sync history exists';
      END IF;
    END $$;
    DROP TABLE IF EXISTS sync_mutation;
    DROP TABLE IF EXISTS attachment;
    DROP TABLE IF EXISTS gps_track_point;
    ALTER TABLE measurement DROP COLUMN IF EXISTS gps_accuracy_m;
  `)
}
