/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX measurement_map_page_idx
      ON measurement (case_work_item_id, created_at, id)
      WHERE deleted_at IS NULL AND status NOT IN ('superseded', 'deleted');
    CREATE INDEX measurement_map_geometry_gix ON measurement USING gist
      ((COALESCE(normalized_geometry, raw_geometry)));
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS measurement_map_geometry_gix;
    DROP INDEX IF EXISTS measurement_map_page_idx;
  `)
}
