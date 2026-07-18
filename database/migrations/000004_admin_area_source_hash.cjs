/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE admin_area ADD COLUMN source_hash char(64);
    ALTER TABLE admin_area ADD CONSTRAINT admin_area_source_hash_format CHECK (
      source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'
    );
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE admin_area DROP CONSTRAINT IF EXISTS admin_area_source_hash_format;
    ALTER TABLE admin_area DROP COLUMN IF EXISTS source_hash;
  `)
}
