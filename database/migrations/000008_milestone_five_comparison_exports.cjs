/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE source_quantity_kind AS ENUM ('estimate', 'contract', 'reported', 'accepted', 'other');
    ALTER TABLE inspection_case ADD COLUMN warning_threshold jsonb NOT NULL DEFAULT '{}'::jsonb;

    CREATE TABLE source_quantity (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      case_work_item_id uuid NOT NULL REFERENCES case_work_item(id),
      source_kind source_quantity_kind NOT NULL,
      document_no text, document_date date,
      quantity numeric(24, 8) NOT NULL CHECK (quantity >= 0),
      unit text NOT NULL, period_start date, period_end date, note text,
      attachment_id uuid REFERENCES attachment(id),
      created_by uuid NOT NULL REFERENCES app_user(id),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT source_quantity_dates CHECK (
        period_start IS NULL OR period_end IS NULL OR period_end >= period_start
      )
    );
    CREATE INDEX source_quantity_work_item_idx ON source_quantity (case_work_item_id, source_kind)
      WHERE deleted_at IS NULL;
    CREATE TRIGGER source_quantity_updated_at BEFORE UPDATE ON source_quantity
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TABLE comparison_explanation (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_quantity_id uuid NOT NULL REFERENCES source_quantity(id),
      explanation text NOT NULL CHECK (length(explanation) BETWEEN 3 AND 5000),
      attachment_id uuid REFERENCES attachment(id),
      created_by uuid NOT NULL REFERENCES app_user(id), updated_by uuid NOT NULL REFERENCES app_user(id),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE UNIQUE INDEX comparison_explanation_current_uidx
      ON comparison_explanation (source_quantity_id) WHERE deleted_at IS NULL;
    CREATE TRIGGER comparison_explanation_updated_at BEFORE UPDATE ON comparison_explanation
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TABLE case_snapshot (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      inspection_case_id uuid NOT NULL REFERENCES inspection_case(id),
      snapshot_type text NOT NULL CHECK (snapshot_type IN ('lock', 'export')),
      snapshot_hash char(64) NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
      summary jsonb NOT NULL, created_by uuid NOT NULL REFERENCES app_user(id),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX case_snapshot_case_idx ON case_snapshot (inspection_case_id, created_at DESC);

    CREATE TABLE export_record (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      inspection_case_id uuid NOT NULL REFERENCES inspection_case(id),
      snapshot_id uuid NOT NULL REFERENCES case_snapshot(id),
      format text NOT NULL CHECK (format IN ('xlsx', 'geojson')),
      file_name text NOT NULL, file_hash char(64) NOT NULL CHECK (file_hash ~ '^[0-9a-f]{64}$'),
      size_bytes bigint NOT NULL CHECK (size_bytes > 0), filters jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by uuid NOT NULL REFERENCES app_user(id), created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX export_record_case_idx ON export_record (inspection_case_id, created_at DESC);
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM source_quantity LIMIT 1)
        OR EXISTS (SELECT 1 FROM case_snapshot LIMIT 1)
        OR EXISTS (SELECT 1 FROM export_record LIMIT 1) THEN
        RAISE EXCEPTION 'Refusing M5 rollback: comparison, snapshot or export history exists';
      END IF;
    END $$;
    DROP TABLE export_record;
    DROP TABLE case_snapshot;
    DROP TABLE comparison_explanation;
    DROP TABLE source_quantity;
    ALTER TABLE inspection_case DROP COLUMN warning_threshold;
    DROP TYPE source_quantity_kind;
  `)
}
