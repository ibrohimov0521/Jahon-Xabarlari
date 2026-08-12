#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "Foydalanish: sh scripts/restore-dokploy.sh /path/railway-production.dump" >&2
  exit 1
fi

project="best-team-news"
backup="$1"
postgres_container="$(docker ps --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=postgres" --format '{{.ID}}' | head -n 1)"

if [ -z "$postgres_container" ]; then
  echo "Best Team News PostgreSQL konteyneri topilmadi." >&2
  exit 1
fi

echo "Yozuvchi servislar vaqtincha to'xtatilmoqda..."
for service in backend telegram-bot media-renderer frontend; do
  ids="$(docker ps --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=$service" --format '{{.ID}}')"
  [ -z "$ids" ] || docker stop $ids >/dev/null
done

docker cp "$backup" "$postgres_container:/tmp/production.dump"
docker exec "$postgres_container" sh -c 'dropdb --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker exec "$postgres_container" sh -c 'pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/production.dump'
docker exec "$postgres_container" rm -f /tmp/production.dump

echo "Baza tiklandi. Dokploy panelida Compose xizmatini qayta Deploy qiling."
