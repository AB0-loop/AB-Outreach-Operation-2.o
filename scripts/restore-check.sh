#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
: "${1:?Pass a .dump file}"
file="$1"
sha256sum -c "$file.sha256"
base="${RESTORE_ADMIN_URL:-$DATABASE_URL}"
name="aurum_restore_test_$(date -u +%Y%m%d%H%M%S)"
cleanup(){ psql "$base" -v ON_ERROR_STOP=1 -c "drop database if exists $name" >/dev/null; }
trap cleanup EXIT
psql "$base" -v ON_ERROR_STOP=1 -c "create database $name" >/dev/null
node -e "const u=new URL(process.argv[1]);u.pathname='/' + process.argv[2];console.log(u.toString())" "$base" "$name" > /tmp/aurum-restore-url
url=$(cat /tmp/aurum-restore-url)
pg_restore --dbname="$url" --no-owner --no-acl "$file"
psql "$url" -v ON_ERROR_STOP=1 -Atc "select count(*) from information_schema.tables where table_schema='aurum_acquisition'" | grep -Eq '^[1-9][0-9]*$'
echo "restore verification passed"
