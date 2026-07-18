/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE attachment DROP CONSTRAINT attachment_parent;
    ALTER TABLE attachment ADD CONSTRAINT attachment_parent
      CHECK (num_nonnulls(measurement_id, case_work_item_id) = 1);
    ALTER TABLE attachment ADD CONSTRAINT attachment_mime_type
      CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'));
    ALTER TABLE attachment ADD CONSTRAINT attachment_expected_sha256_hex
      CHECK (expected_sha256 ~ '^[0-9a-f]{64}$');
    ALTER TABLE attachment ADD CONSTRAINT attachment_sha256_hex
      CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$');
  `)
}

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE attachment DROP CONSTRAINT attachment_sha256_hex;
    ALTER TABLE attachment DROP CONSTRAINT attachment_expected_sha256_hex;
    ALTER TABLE attachment DROP CONSTRAINT attachment_mime_type;
    ALTER TABLE attachment DROP CONSTRAINT attachment_parent;
    ALTER TABLE attachment ADD CONSTRAINT attachment_parent
      CHECK (measurement_id IS NOT NULL OR case_work_item_id IS NOT NULL);
  `)
}
