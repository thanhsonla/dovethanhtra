/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE management_zone (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      display_order integer NOT NULL DEFAULT 0,
      active boolean NOT NULL DEFAULT true,
      system_seed boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT management_zone_code CHECK (code ~ '^[A-Z0-9_]+$'),
      CONSTRAINT management_zone_name CHECK (length(btrim(name)) > 0),
      CONSTRAINT management_zone_version CHECK (version > 0),
      CONSTRAINT management_zone_delete_state CHECK (
        (deleted_at IS NULL AND active) OR (deleted_at IS NOT NULL AND NOT active)
      )
    );
    CREATE INDEX management_zone_active_idx ON management_zone (display_order, name)
      WHERE deleted_at IS NULL AND active;
    CREATE TRIGGER management_zone_updated_at BEFORE UPDATE ON management_zone
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    INSERT INTO management_zone (code, name, display_order, system_seed)
    SELECT DISTINCT ON (a.code) a.code, a.name,
      row_number() OVER (ORDER BY a.name)::integer * 10, true
    FROM admin_area a
    WHERE a.area_type = 'management_zone' AND a.deleted_at IS NULL
    ORDER BY a.code, a.name;

    ALTER TABLE case_work_item
      ADD COLUMN management_zone_id uuid REFERENCES management_zone(id);
    UPDATE case_work_item w SET management_zone_id = z.id
    FROM admin_area a JOIN management_zone z ON z.code = a.code
    WHERE w.management_area_id = a.id;

    DROP TRIGGER IF EXISTS case_work_item_classification_guard ON case_work_item;
    DROP FUNCTION IF EXISTS validate_work_item_classification();
    DROP INDEX IF EXISTS work_item_management_group_idx;
    ALTER TABLE case_work_item DROP COLUMN management_area_id;
    CREATE INDEX work_item_management_group_idx
      ON case_work_item (management_zone_id, service_group_id, status)
      WHERE deleted_at IS NULL;

    CREATE OR REPLACE FUNCTION validate_work_item_classification()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      template_group_id uuid;
      template_kind measurement_kind;
    BEGIN
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
      BEFORE INSERT OR UPDATE OF service_group_id, measurement_kind, work_type_id
      ON case_work_item FOR EACH ROW EXECUTE FUNCTION validate_work_item_classification();
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM case_work_item WHERE management_zone_id IS NOT NULL LIMIT 1)
        OR EXISTS (SELECT 1 FROM management_zone WHERE NOT system_seed LIMIT 1)
      THEN
        RAISE EXCEPTION 'Refusing management-zone rollback: user classifications or names exist';
      END IF;
    END $$;

    DROP TRIGGER IF EXISTS case_work_item_classification_guard ON case_work_item;
    DROP FUNCTION IF EXISTS validate_work_item_classification();
    DROP INDEX IF EXISTS work_item_management_group_idx;
    ALTER TABLE case_work_item
      ADD COLUMN management_area_id uuid REFERENCES admin_area(id);
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
        IF NEW.service_group_id IS NULL THEN NEW.service_group_id := template_group_id; END IF;
        IF NEW.measurement_kind IS NULL THEN NEW.measurement_kind := template_kind; END IF;
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

    ALTER TABLE case_work_item DROP COLUMN management_zone_id;
    DROP TRIGGER IF EXISTS management_zone_updated_at ON management_zone;
    DROP TABLE management_zone;
  `)
}
