/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE capture_draft
      ADD COLUMN classification_idempotency_key text,
      ADD COLUMN classification_payload_hash char(64);

    UPDATE capture_draft SET
      classification_idempotency_key = 'legacy:' || id::text,
      classification_payload_hash = encode(sha256(('legacy:' || id::text)::bytea), 'hex')
    WHERE status = 'classified';

    ALTER TABLE capture_draft
      ADD CONSTRAINT capture_draft_classification_identity CHECK (
        (classification_idempotency_key IS NULL AND classification_payload_hash IS NULL)
        OR (
          length(btrim(classification_idempotency_key)) > 0
          AND classification_payload_hash ~ '^[0-9a-f]{64}$'
        )
      );
    CREATE UNIQUE INDEX capture_draft_classification_idempotency_uidx
      ON capture_draft (created_by, device_id, classification_idempotency_key)
      WHERE classification_idempotency_key IS NOT NULL;

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
        SELECT wc.name INTO component_name FROM work_component wc
        WHERE wc.id = NEW.work_component_id
          AND wc.case_work_item_id = NEW.case_work_item_id
          AND wc.deleted_at IS NULL;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'work component does not belong to the measurement work item';
        END IF;
      END IF;

      IF NEW.capture_draft_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM capture_draft cd
          WHERE cd.id = NEW.capture_draft_id AND cd.inspection_case_id = work_case_id)
        THEN
          RAISE EXCEPTION 'capture draft does not belong to the measurement case';
        END IF;
        IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM capture_draft cd
          WHERE cd.id = NEW.capture_draft_id AND cd.deleted_at IS NOT NULL)
        THEN
          RAISE EXCEPTION 'new measurement cannot use a deleted capture draft';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.capture_draft_id IS DISTINCT FROM OLD.capture_draft_id
          AND EXISTS (SELECT 1 FROM capture_draft cd
            WHERE cd.id = NEW.capture_draft_id AND cd.deleted_at IS NOT NULL)
        THEN
          RAISE EXCEPTION 'measurement cannot be moved to a deleted capture draft';
        END IF;
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
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM capture_draft
        WHERE classification_idempotency_key IS NOT NULL
          AND classification_idempotency_key NOT LIKE 'legacy:%'
        LIMIT 1
      ) THEN
        RAISE EXCEPTION 'Refusing capture-draft API rollback: classification idempotency exists';
      END IF;
    END $$;

    DROP INDEX capture_draft_classification_idempotency_uidx;
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
        SELECT wc.name INTO component_name FROM work_component wc
        WHERE wc.id = NEW.work_component_id
          AND wc.case_work_item_id = NEW.case_work_item_id AND wc.deleted_at IS NULL;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'work component does not belong to the measurement work item';
        END IF;
      END IF;
      IF NEW.capture_draft_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM capture_draft cd WHERE cd.id = NEW.capture_draft_id
          AND cd.inspection_case_id = work_case_id AND cd.deleted_at IS NULL
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
    ALTER TABLE capture_draft
      DROP CONSTRAINT capture_draft_classification_identity,
      DROP COLUMN classification_payload_hash,
      DROP COLUMN classification_idempotency_key;
  `)
}
