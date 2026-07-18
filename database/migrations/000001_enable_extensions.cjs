/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true })
  pgm.createExtension('postgis', { ifNotExists: true })
}

/**
 * Chỉ chạy rollback này trên database kiểm thử/cục bộ trống. Các bảng nghiệp vụ
 * ở mốc sau sẽ phụ thuộc PostGIS và phải được rollback trước extension.
 * @type {import('node-pg-migrate').MigrationBuilderActions}
 */
exports.down = (pgm) => {
  pgm.sql('DROP EXTENSION IF EXISTS postgis CASCADE')
  pgm.dropExtension('pgcrypto', { ifExists: true })
}
