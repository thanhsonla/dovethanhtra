/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE app_role AS ENUM ('owner', 'editor', 'reviewer', 'viewer', 'catalog_admin');
    CREATE TYPE case_status AS ENUM ('draft', 'in_progress', 'review', 'locked', 'archived');
    CREATE TYPE measurement_kind AS ENUM ('count', 'point', 'line', 'area', 'route', 'composite');
    CREATE TYPE work_item_status AS ENUM ('draft', 'active', 'completed', 'archived');

    CREATE TABLE app_user (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      display_name text NOT NULL,
      password_hash text NOT NULL,
      role app_role NOT NULL DEFAULT 'owner',
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX app_user_email_lower_uidx ON app_user (lower(email));

    CREATE TABLE app_session (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES app_user(id),
      token_hash char(64) NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT app_session_expiry CHECK (expires_at > created_at)
    );
    CREATE INDEX app_session_active_idx ON app_session (token_hash, expires_at)
      WHERE revoked_at IS NULL;

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
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT admin_area_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
      CONSTRAINT admin_area_boundary_valid CHECK (ST_IsValid(boundary)),
      UNIQUE (code, source_version)
    );
    CREATE INDEX admin_area_boundary_gix ON admin_area USING gist (boundary);

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
      version integer NOT NULL DEFAULT 1,
      locked_at timestamptz,
      locked_by uuid REFERENCES app_user(id),
      lock_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT inspection_case_dates CHECK (period_end >= period_start),
      CONSTRAINT inspection_case_version CHECK (version > 0),
      CONSTRAINT inspection_case_boundary_valid CHECK (ST_IsValid(boundary_snapshot)),
      CONSTRAINT inspection_case_lock_consistency CHECK (
        (status = 'locked' AND locked_at IS NOT NULL AND locked_by IS NOT NULL)
        OR status <> 'locked'
      )
    );
    CREATE INDEX inspection_case_owner_idx ON inspection_case (owner_id, updated_at DESC)
      WHERE deleted_at IS NULL;
    CREATE INDEX inspection_case_boundary_gix ON inspection_case USING gist (boundary_snapshot);

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
    CREATE INDEX work_type_group_idx ON work_type (service_group_id, active, name);

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
    CREATE INDEX work_item_case_idx ON case_work_item (inspection_case_id, status)
      WHERE deleted_at IS NULL;

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
    CREATE INDEX audit_case_time_idx ON audit_event (inspection_case_id, occurred_at DESC);

    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION prevent_audit_mutation()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'audit_event is append-only';
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
    CREATE TRIGGER audit_event_append_only BEFORE UPDATE OR DELETE ON audit_event
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS audit_event_append_only ON audit_event;
    DROP TABLE IF EXISTS audit_event;
    DROP TABLE IF EXISTS case_work_item;
    DROP TABLE IF EXISTS work_type;
    DROP TABLE IF EXISTS service_group;
    DROP TABLE IF EXISTS inspection_case;
    DROP TABLE IF EXISTS admin_area;
    DROP TABLE IF EXISTS app_session;
    DROP TABLE IF EXISTS app_user;
    DROP FUNCTION IF EXISTS prevent_audit_mutation();
    DROP FUNCTION IF EXISTS set_updated_at();
    DROP TYPE IF EXISTS work_item_status;
    DROP TYPE IF EXISTS measurement_kind;
    DROP TYPE IF EXISTS case_status;
    DROP TYPE IF EXISTS app_role;
  `)
}
