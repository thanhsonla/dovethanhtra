/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE capture_draft_status AS ENUM (
      'unclassified', 'classifying', 'classified', 'conflict', 'deleted'
    );

    ALTER TABLE admin_area
      ADD COLUMN version integer NOT NULL DEFAULT 1,
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN deleted_at timestamptz,
      ADD CONSTRAINT admin_area_record_version CHECK (version > 0);
    CREATE TRIGGER admin_area_updated_at BEFORE UPDATE ON admin_area
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE INDEX admin_area_management_idx
      ON admin_area (area_type, valid_from, valid_to)
      WHERE deleted_at IS NULL;

    ALTER TABLE service_group
      ADD COLUMN quick_default boolean NOT NULL DEFAULT false,
      ADD COLUMN quick_label text,
      ADD COLUMN version integer NOT NULL DEFAULT 1,
      ADD COLUMN deleted_at timestamptz,
      ADD CONSTRAINT service_group_record_version CHECK (version > 0),
      ADD CONSTRAINT service_group_quick_label CHECK (
        NOT quick_default OR length(btrim(quick_label)) > 0
      );
    CREATE INDEX service_group_quick_idx
      ON service_group (display_order, name)
      WHERE quick_default AND active AND deleted_at IS NULL;

    ALTER TABLE case_work_item
      ADD COLUMN management_area_id uuid REFERENCES admin_area(id),
      ADD COLUMN service_group_id uuid REFERENCES service_group(id),
      ADD COLUMN measurement_kind measurement_kind,
      ADD COLUMN version integer NOT NULL DEFAULT 1,
      ADD COLUMN status_before_delete work_item_status,
      ADD CONSTRAINT case_work_item_record_version CHECK (version > 0);

    UPDATE case_work_item w
    SET service_group_id = wt.service_group_id,
        measurement_kind = wt.measurement_kind
    FROM work_type wt
    WHERE wt.id = w.work_type_id;

    ALTER TABLE case_work_item
      ALTER COLUMN service_group_id SET NOT NULL,
      ALTER COLUMN measurement_kind SET NOT NULL,
      ALTER COLUMN work_type_id DROP NOT NULL;

    CREATE INDEX work_item_management_group_idx
      ON case_work_item (management_area_id, service_group_id, status)
      WHERE deleted_at IS NULL;

    CREATE OR REPLACE FUNCTION validate_work_item_classification()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      template_group_id uuid;
      template_kind measurement_kind;
    BEGIN
      IF NEW.management_area_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM admin_area a
        WHERE a.id = NEW.management_area_id
          AND a.area_type = 'management_zone'
          AND a.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'management_area_id must reference an active management_zone';
      END IF;

      IF NEW.work_type_id IS NOT NULL THEN
        SELECT wt.service_group_id, wt.measurement_kind
        INTO template_group_id, template_kind
        FROM work_type wt WHERE wt.id = NEW.work_type_id;

        IF template_group_id IS NULL THEN
          RAISE EXCEPTION 'work type template does not exist';
        END IF;
        IF NEW.service_group_id IS NULL THEN
          NEW.service_group_id := template_group_id;
        END IF;
        IF NEW.measurement_kind IS NULL THEN
          NEW.measurement_kind := template_kind;
        END IF;
        IF template_group_id <> NEW.service_group_id
          OR template_kind <> NEW.measurement_kind
        THEN
          RAISE EXCEPTION 'work type template does not match service group and measurement kind';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER case_work_item_classification_guard
      BEFORE INSERT OR UPDATE OF management_area_id, service_group_id, measurement_kind, work_type_id
      ON case_work_item FOR EACH ROW EXECUTE FUNCTION validate_work_item_classification();

    CREATE TABLE work_component (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      case_work_item_id uuid NOT NULL REFERENCES case_work_item(id),
      name text NOT NULL DEFAULT '',
      display_order integer NOT NULL DEFAULT 0,
      status work_item_status NOT NULL DEFAULT 'draft',
      status_before_delete work_item_status,
      version integer NOT NULL DEFAULT 1,
      created_by uuid NOT NULL REFERENCES app_user(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT work_component_version CHECK (version > 0),
      CONSTRAINT work_component_delete_state CHECK (
        deleted_at IS NULL OR status = 'archived'
      )
    );
    CREATE INDEX work_component_work_idx
      ON work_component (case_work_item_id, display_order, created_at)
      WHERE deleted_at IS NULL;
    CREATE TRIGGER work_component_updated_at BEFORE UPDATE ON work_component
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TABLE capture_draft (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      inspection_case_id uuid NOT NULL REFERENCES inspection_case(id),
      local_id text NOT NULL,
      device_id text NOT NULL,
      idempotency_key text NOT NULL,
      payload_hash char(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
      geometry_kind measurement_kind NOT NULL,
      method measurement_method NOT NULL DEFAULT 'map_draw',
      raw_geometry geometry(Geometry, 4326) NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      status capture_draft_status NOT NULL DEFAULT 'unclassified',
      status_before_delete capture_draft_status,
      version integer NOT NULL DEFAULT 1,
      classified_measurement_id uuid,
      created_by uuid NOT NULL REFERENCES app_user(id),
      classified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT capture_draft_identity_nonempty CHECK (
        length(btrim(local_id)) > 0
        AND length(btrim(device_id)) > 0
        AND length(btrim(idempotency_key)) > 0
      ),
      CONSTRAINT capture_draft_version CHECK (version > 0),
      CONSTRAINT capture_draft_kind CHECK (geometry_kind IN ('point', 'line', 'area')),
      CONSTRAINT capture_draft_geometry_nonempty CHECK (NOT ST_IsEmpty(raw_geometry)),
      CONSTRAINT capture_draft_geometry_kind CHECK (
        (geometry_kind = 'point' AND GeometryType(raw_geometry) IN ('POINT', 'MULTIPOINT'))
        OR (geometry_kind = 'line'
          AND GeometryType(raw_geometry) IN ('LINESTRING', 'MULTILINESTRING'))
        OR (geometry_kind = 'area'
          AND GeometryType(raw_geometry) IN ('POLYGON', 'MULTIPOLYGON'))
      ),
      UNIQUE (created_by, device_id, local_id),
      UNIQUE (created_by, device_id, idempotency_key),
      UNIQUE (classified_measurement_id)
    );
    CREATE INDEX capture_draft_case_status_idx
      ON capture_draft (inspection_case_id, status, created_at DESC)
      WHERE deleted_at IS NULL;
    CREATE INDEX capture_draft_creator_idx
      ON capture_draft (created_by, created_at DESC)
      WHERE deleted_at IS NULL;
    CREATE INDEX capture_draft_geometry_gix ON capture_draft USING gist (raw_geometry);
    CREATE TRIGGER capture_draft_updated_at BEFORE UPDATE ON capture_draft
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    ALTER TABLE measurement
      ADD COLUMN work_component_id uuid REFERENCES work_component(id),
      ADD COLUMN capture_draft_id uuid REFERENCES capture_draft(id);
    CREATE INDEX measurement_component_idx
      ON measurement (work_component_id, status, created_at DESC)
      WHERE work_component_id IS NOT NULL AND deleted_at IS NULL;
    CREATE UNIQUE INDEX measurement_capture_draft_uidx
      ON measurement (capture_draft_id) WHERE capture_draft_id IS NOT NULL;

    ALTER TABLE capture_draft
      ADD CONSTRAINT capture_draft_classified_measurement_fk
        FOREIGN KEY (classified_measurement_id) REFERENCES measurement(id),
      ADD CONSTRAINT capture_draft_lifecycle CHECK (
        (status = 'classified' AND classified_measurement_id IS NOT NULL
          AND classified_at IS NOT NULL AND deleted_at IS NULL
          AND status_before_delete IS NULL)
        OR (status = 'deleted' AND deleted_at IS NOT NULL
          AND status_before_delete IS NOT NULL AND status_before_delete <> 'deleted')
        OR (status IN ('unclassified', 'classifying', 'conflict')
          AND classified_measurement_id IS NULL AND classified_at IS NULL
          AND deleted_at IS NULL AND status_before_delete IS NULL)
      );

    CREATE OR REPLACE FUNCTION validate_measurement_map_first_links()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      work_case_id uuid;
      work_name text;
      component_name text;
    BEGIN
      SELECT w.inspection_case_id, w.name INTO work_case_id, work_name
      FROM case_work_item w WHERE w.id = NEW.case_work_item_id;

      IF NEW.work_component_id IS NOT NULL THEN
        SELECT wc.name INTO component_name
        FROM work_component wc
        WHERE wc.id = NEW.work_component_id
          AND wc.case_work_item_id = NEW.case_work_item_id
          AND wc.deleted_at IS NULL;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'work component does not belong to the measurement work item';
        END IF;
      END IF;

      IF NEW.capture_draft_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM capture_draft cd
        WHERE cd.id = NEW.capture_draft_id
          AND cd.inspection_case_id = work_case_id
          AND cd.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'capture draft does not belong to the measurement case';
      END IF;

      IF NEW.status = 'confirmed' THEN
        IF length(btrim(work_name)) = 0 THEN
          RAISE EXCEPTION 'confirmed measurement requires a named work item';
        END IF;
        IF NEW.work_component_id IS NOT NULL AND length(btrim(component_name)) = 0 THEN
          RAISE EXCEPTION 'confirmed measurement requires a named work component';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER measurement_map_first_link_guard
      BEFORE INSERT OR UPDATE OF case_work_item_id, work_component_id, capture_draft_id, status
      ON measurement FOR EACH ROW EXECUTE FUNCTION validate_measurement_map_first_links();

    CREATE OR REPLACE FUNCTION validate_capture_draft_classification()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.classified_measurement_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM measurement m
        JOIN case_work_item w ON w.id = m.case_work_item_id
        WHERE m.id = NEW.classified_measurement_id
          AND m.capture_draft_id = NEW.id
          AND w.inspection_case_id = NEW.inspection_case_id
      ) THEN
        RAISE EXCEPTION 'classified measurement must point back to the same capture draft and case';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER capture_draft_classification_guard
      BEFORE INSERT OR UPDATE OF classified_measurement_id, inspection_case_id
      ON capture_draft FOR EACH ROW EXECUTE FUNCTION validate_capture_draft_classification();
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM work_component LIMIT 1)
        OR EXISTS (SELECT 1 FROM capture_draft LIMIT 1)
        OR EXISTS (SELECT 1 FROM measurement
          WHERE work_component_id IS NOT NULL OR capture_draft_id IS NOT NULL LIMIT 1)
        OR EXISTS (SELECT 1 FROM case_work_item
          WHERE work_type_id IS NULL OR management_area_id IS NOT NULL LIMIT 1)
        OR EXISTS (
          SELECT 1 FROM case_work_item w JOIN work_type wt ON wt.id = w.work_type_id
          WHERE w.service_group_id <> wt.service_group_id
            OR w.measurement_kind <> wt.measurement_kind
          LIMIT 1
        )
      THEN
        RAISE EXCEPTION 'Refusing map-first rollback: new classifications or drafts exist';
      END IF;
    END $$;

    DROP TRIGGER IF EXISTS capture_draft_classification_guard ON capture_draft;
    DROP TRIGGER IF EXISTS measurement_map_first_link_guard ON measurement;
    DROP FUNCTION IF EXISTS validate_capture_draft_classification();
    DROP FUNCTION IF EXISTS validate_measurement_map_first_links();

    DROP INDEX IF EXISTS measurement_capture_draft_uidx;
    DROP INDEX IF EXISTS measurement_component_idx;
    ALTER TABLE measurement
      DROP COLUMN IF EXISTS capture_draft_id,
      DROP COLUMN IF EXISTS work_component_id;

    DROP TABLE IF EXISTS capture_draft;
    DROP TABLE IF EXISTS work_component;

    DROP TRIGGER IF EXISTS case_work_item_classification_guard ON case_work_item;
    DROP FUNCTION IF EXISTS validate_work_item_classification();
    DROP INDEX IF EXISTS work_item_management_group_idx;
    ALTER TABLE case_work_item
      ALTER COLUMN work_type_id SET NOT NULL,
      DROP CONSTRAINT IF EXISTS case_work_item_record_version,
      DROP COLUMN IF EXISTS status_before_delete,
      DROP COLUMN IF EXISTS version,
      DROP COLUMN IF EXISTS measurement_kind,
      DROP COLUMN IF EXISTS service_group_id,
      DROP COLUMN IF EXISTS management_area_id;

    DROP INDEX IF EXISTS service_group_quick_idx;
    ALTER TABLE service_group
      DROP CONSTRAINT IF EXISTS service_group_quick_label,
      DROP CONSTRAINT IF EXISTS service_group_record_version,
      DROP COLUMN IF EXISTS deleted_at,
      DROP COLUMN IF EXISTS version,
      DROP COLUMN IF EXISTS quick_label,
      DROP COLUMN IF EXISTS quick_default;

    DROP INDEX IF EXISTS admin_area_management_idx;
    DROP TRIGGER IF EXISTS admin_area_updated_at ON admin_area;
    ALTER TABLE admin_area
      DROP CONSTRAINT IF EXISTS admin_area_record_version,
      DROP COLUMN IF EXISTS deleted_at,
      DROP COLUMN IF EXISTS updated_at,
      DROP COLUMN IF EXISTS version;

    DROP TYPE IF EXISTS capture_draft_status;
  `)
}
