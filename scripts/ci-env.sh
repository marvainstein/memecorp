#!/usr/bin/env bash
# Loads the import configuration for GitHub Actions into $GITHUB_ENV.
# Accepts one secret REPOSECRETS holding the whole .env.cloud.local (KEY=VALUE lines) and/or
# one secret per variable; a per-variable secret wins over the same key in REPOSECRETS.
set -euo pipefail

ALLOWED='^(DATABASE_URL|DATABASE_POOL_SIZE|STORAGE_DRIVER|S3_[A-Z_]+|REDDIT_[A-Z_]+|PINTEREST_[A-Z_]+|IMPORT_[A-Z_]+)$'
SENSITIVE='^(DATABASE_URL|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|REDDIT_CLIENT_SECRET|PINTEREST_ACCESS_TOKEN)$'
keys="" # values live in conf_<KEY> (portable to bash 3.2, which lacks associative arrays)

set_conf() {
  printf -v "conf_$1" '%s' "$2"
  case " $keys " in *" $1 "*) ;; *) keys="$keys $1" ;; esac
}
get_conf() { local name="conf_$1"; printf '%s' "${!name:-}"; }

clean() { # trims spaces and one pair of surrounding quotes
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  if [[ "$v" =~ ^\"(.*)\"$ || "$v" =~ ^\'(.*)\'$ ]]; then v="${BASH_REMATCH[1]}"; fi
  printf '%s' "$v"
}

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Z0-9_]+)[[:space:]]*=(.*)$ ]] || continue
  key="${BASH_REMATCH[2]}"
  value="$(clean "${BASH_REMATCH[3]}")"
  if [[ "$key" =~ $ALLOWED && -n "$value" ]]; then set_conf "$key" "$value"; fi
done <<< "${REPOSECRETS:-}"

for key in DATABASE_URL STORAGE_DRIVER S3_BUCKET S3_REGION S3_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY \
  REDDIT_CLIENT_ID REDDIT_CLIENT_SECRET PINTEREST_ACCESS_TOKEN; do
  value="$(clean "${!key:-}")"
  if [ -n "$value" ]; then set_conf "$key" "$value"; fi
done

missing=""
for key in DATABASE_URL S3_BUCKET S3_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do
  [ -n "$(get_conf "$key")" ] || missing="$missing $key"
done
if [ -n "$missing" ]; then
  echo "::error::Falta configuración:$missing. Cargala en Settings → Secrets and variables → Actions → Secrets, como un secret REPOSECRETS con las líneas KEY=VALUE de .env.cloud.local o un secret por variable."
  exit 1
fi

for key in $keys; do
  value="$(get_conf "$key")"
  if [[ "$key" =~ $SENSITIVE ]]; then echo "::add-mask::$value"; fi
  echo "$key=$value" >> "${GITHUB_ENV:?}"
done
echo "Configuración cargada:$keys"
