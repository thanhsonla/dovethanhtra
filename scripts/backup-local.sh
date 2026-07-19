#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/backup-local.sh /absolute/path/to/new-backup-directory" >&2
  exit 64
fi

backup_dir=$1
case "$backup_dir" in
  /*) ;;
  *) echo "Backup path must be absolute." >&2; exit 64 ;;
esac
if [ "$backup_dir" = "/" ] || [ -e "$backup_dir" ]; then
  echo "Backup target must be a new directory and cannot be /." >&2
  exit 64
fi

mkdir -p "$backup_dir/objects"
docker compose exec -T postgis sh -eu -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "$backup_dir/database.dump"

absolute_backup_dir=$(cd "$backup_dir" && pwd)
docker compose run --rm -T \
  --volume "$absolute_backup_dir/objects:/backup/objects" \
  --entrypoint /bin/sh minio-init -eu -c \
  'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null &&
   mc mirror --overwrite "local/$MINIO_BUCKET" /backup/objects'

(
  cd "$backup_dir"
  find . -type f ! -name SHA256SUMS -exec shasum -a 256 {} \; | sort > SHA256SUMS
  {
    echo "created_at_utc=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "database_format=postgres_custom"
    echo "object_bucket=${MINIO_BUCKET:-dove-evidence-local}"
  } > MANIFEST
  shasum -a 256 MANIFEST >> SHA256SUMS
)

echo "Backup created and hashed at: $absolute_backup_dir"
