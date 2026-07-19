#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/verify-restore-local.sh /absolute/path/to/backup-directory" >&2
  exit 64
fi

backup_dir=$1
case "$backup_dir" in
  /*) ;;
  *) echo "Backup path must be absolute." >&2; exit 64 ;;
esac
if [ ! -f "$backup_dir/database.dump" ] || [ ! -f "$backup_dir/SHA256SUMS" ]; then
  echo "Backup is incomplete: database.dump or SHA256SUMS is missing." >&2
  exit 65
fi

(
  cd "$backup_dir"
  shasum -a 256 -c SHA256SUMS
)

verify_database="dove_restore_verify_$$"
verify_bucket="dove-restore-verify-$(date -u '+%Y%m%d%H%M%S')-$$"
verify_object_dir=$(mktemp -d /tmp/dove-restore-objects.XXXXXX)
cleanup() {
  docker compose exec -T -e VERIFY_DATABASE="$verify_database" postgis sh -eu -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" dropdb -U "$POSTGRES_USER" --if-exists "$VERIFY_DATABASE"' \
    >/dev/null 2>&1 || true
  docker compose run --rm -T -e VERIFY_BUCKET="$verify_bucket" --entrypoint /bin/sh minio-init \
    -eu -c 'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
      mc rm --recursive --force "local/$VERIFY_BUCKET" >/dev/null 2>&1 || true
      mc rb "local/$VERIFY_BUCKET" >/dev/null 2>&1 || true' >/dev/null 2>&1 || true
  find "$verify_object_dir" -depth -delete >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker compose exec -T -e VERIFY_DATABASE="$verify_database" postgis sh -eu -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" createdb -U "$POSTGRES_USER" "$VERIFY_DATABASE"'
docker compose exec -T -e VERIFY_DATABASE="$verify_database" postgis sh -eu -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$VERIFY_DATABASE" --no-owner --no-acl' \
  < "$backup_dir/database.dump"
docker compose exec -T -e VERIFY_DATABASE="$verify_database" postgis sh -eu -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$VERIFY_DATABASE" -v ON_ERROR_STOP=1 -Atc \
   "SELECT postgis_version(); SELECT count(*) FROM inspection_case; SELECT count(*) FROM audit_event;"'

absolute_backup_dir=$(cd "$backup_dir" && pwd)
docker compose run --rm -T \
  --volume "$absolute_backup_dir/objects:/backup/objects:ro" \
  --volume "$verify_object_dir:/verify/objects" \
  -e VERIFY_BUCKET="$verify_bucket" \
  --entrypoint /bin/sh minio-init -eu -c \
  'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
   mc mb "local/$VERIFY_BUCKET" >/dev/null
   mc mirror --overwrite /backup/objects "local/$VERIFY_BUCKET"
   mc mirror --overwrite "local/$VERIFY_BUCKET" /verify/objects'

diff -qr "$backup_dir/objects" "$verify_object_dir"

cleanup
trap - EXIT INT TERM
echo "Restore verification passed for database and object storage."
