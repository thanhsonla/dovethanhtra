/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE measurement_import_batch (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      case_work_item_id uuid NOT NULL REFERENCES case_work_item(id),
      source_name text NOT NULL,
      source_hash char(64) NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
      size_bytes bigint NOT NULL CHECK (size_bytes > 0),
      feature_count integer NOT NULL CHECK (feature_count BETWEEN 1 AND 1000),
      detected_schema jsonb NOT NULL,
      imported_measurement_ids uuid[] NOT NULL,
      created_by uuid NOT NULL REFERENCES app_user(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (case_work_item_id, source_hash)
    );
    CREATE INDEX measurement_import_batch_work_idx
      ON measurement_import_batch (case_work_item_id, created_at DESC);

    ALTER TABLE measurement ADD COLUMN status_before_delete measurement_status;

    ALTER TABLE export_record
      ALTER COLUMN file_hash DROP NOT NULL,
      ALTER COLUMN size_bytes DROP NOT NULL,
      ADD COLUMN status text NOT NULL DEFAULT 'completed'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      ADD COLUMN object_key text,
      ADD COLUMN started_at timestamptz,
      ADD COLUMN completed_at timestamptz,
      ADD COLUMN error_code text,
      ADD COLUMN error_message text,
      ADD CONSTRAINT export_record_artifact_state CHECK (
        (status = 'completed' AND file_hash IS NOT NULL AND size_bytes IS NOT NULL)
        OR status <> 'completed'
      );
    UPDATE export_record SET completed_at = created_at WHERE status = 'completed';
    CREATE INDEX export_record_pending_idx ON export_record (created_at)
      WHERE status IN ('pending', 'processing');
    CREATE UNIQUE INDEX export_record_object_key_uidx ON export_record (object_key)
      WHERE object_key IS NOT NULL;

    ALTER TABLE attachment
      ADD COLUMN scan_status text NOT NULL DEFAULT 'pending'
        CHECK (scan_status IN ('pending', 'clean', 'infected', 'error', 'not_scanned_legacy')),
      ADD COLUMN scan_provider text,
      ADD COLUMN scan_version text,
      ADD COLUMN scanned_at timestamptz,
      ADD COLUMN thumbnail_object_key text,
      ADD COLUMN thumbnail_mime_type text,
      ADD COLUMN thumbnail_size_bytes bigint CHECK (thumbnail_size_bytes > 0),
      ADD COLUMN thumbnail_sha256 char(64)
        CHECK (thumbnail_sha256 IS NULL OR thumbnail_sha256 ~ '^[0-9a-f]{64}$');
    UPDATE attachment SET scan_status = 'not_scanned_legacy', scan_provider = 'legacy',
      scanned_at = completed_at WHERE upload_status = 'completed';
    ALTER TABLE attachment
      ADD CONSTRAINT attachment_scan_completion CHECK (
        upload_status <> 'completed' OR scan_status IN ('clean', 'not_scanned_legacy')
      ),
      ADD CONSTRAINT attachment_thumbnail_consistency CHECK (
        (thumbnail_object_key IS NULL AND thumbnail_mime_type IS NULL
          AND thumbnail_size_bytes IS NULL AND thumbnail_sha256 IS NULL)
        OR (thumbnail_object_key IS NOT NULL AND thumbnail_mime_type IS NOT NULL
          AND thumbnail_size_bytes IS NOT NULL AND thumbnail_sha256 IS NOT NULL)
      );
    CREATE UNIQUE INDEX attachment_thumbnail_key_uidx ON attachment (thumbnail_object_key)
      WHERE thumbnail_object_key IS NOT NULL;
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM measurement_import_batch LIMIT 1)
        OR EXISTS (SELECT 1 FROM export_record WHERE object_key IS NOT NULL LIMIT 1)
        OR EXISTS (SELECT 1 FROM attachment WHERE thumbnail_object_key IS NOT NULL LIMIT 1)
        OR EXISTS (SELECT 1 FROM attachment WHERE scan_status IN ('clean','infected','error') LIMIT 1)
      THEN
        RAISE EXCEPTION 'Refusing P1 rollback: import, queued export or scanned evidence exists';
      END IF;
    END $$;

    DROP INDEX IF EXISTS attachment_thumbnail_key_uidx;
    ALTER TABLE attachment
      DROP CONSTRAINT IF EXISTS attachment_thumbnail_consistency,
      DROP CONSTRAINT IF EXISTS attachment_scan_completion,
      DROP COLUMN IF EXISTS thumbnail_sha256,
      DROP COLUMN IF EXISTS thumbnail_size_bytes,
      DROP COLUMN IF EXISTS thumbnail_mime_type,
      DROP COLUMN IF EXISTS thumbnail_object_key,
      DROP COLUMN IF EXISTS scanned_at,
      DROP COLUMN IF EXISTS scan_version,
      DROP COLUMN IF EXISTS scan_provider,
      DROP COLUMN IF EXISTS scan_status;

    DROP INDEX IF EXISTS export_record_object_key_uidx;
    DROP INDEX IF EXISTS export_record_pending_idx;
    ALTER TABLE export_record
      DROP CONSTRAINT IF EXISTS export_record_artifact_state,
      DROP COLUMN IF EXISTS error_message,
      DROP COLUMN IF EXISTS error_code,
      DROP COLUMN IF EXISTS completed_at,
      DROP COLUMN IF EXISTS started_at,
      DROP COLUMN IF EXISTS object_key,
      DROP COLUMN IF EXISTS status,
      ALTER COLUMN size_bytes SET NOT NULL,
      ALTER COLUMN file_hash SET NOT NULL;

    DROP TABLE IF EXISTS measurement_import_batch;
    ALTER TABLE measurement DROP COLUMN IF EXISTS status_before_delete;
  `)
}
