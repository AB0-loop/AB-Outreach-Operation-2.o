#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
out="${1:-./backups}"
mkdir -p "$out" && chmod 700 "$out"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="$out/aurum-acquisition-$stamp.dump"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --schema=aurum_acquisition --file="$file"
sha256sum "$file" > "$file.sha256"
chmod 600 "$file" "$file.sha256"
echo "$file"
