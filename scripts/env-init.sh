#!/usr/bin/env bash
set -euo pipefail

prepend_path() {
  if [[ -d "$1" ]]; then
    PATH="$1:$PATH"
  fi
}

prepend_path "/usr/bin"
prepend_path "/mingw64/bin"
prepend_path "/c/Program Files/Git/usr/bin"
prepend_path "/c/Program Files/Git/mingw64/bin"
export PATH

if ! command -v openssl >/dev/null 2>&1; then
  for git_bash in \
    "/c/Program Files/Git/bin/bash.exe" \
    "/c/Program Files (x86)/Git/bin/bash.exe"
  do
    if [[ -x "$git_bash" ]]; then
      exec "$git_bash" "$0" "$@"
    fi
  done
  printf '\033[31mopenssl is required to generate secrets.\033[0m\n' >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
EXAMPLE="$ROOT/.env.example"

if [[ -f "$ENV_FILE" ]]; then
  printf '\033[33m.env already exists — skipped.\033[0m\n'
  exit 0
fi

cookie_key="$(openssl rand -base64 48 | tr -d '\n\r=' | tr '+/' '-_')"
api_daemon_secret="$(openssl rand -hex 32)"
connector_secret="$(openssl rand -hex 32)"

cp "$EXAMPLE" "$ENV_FILE"

sed -i \
  -e "s|^CARTULAIRE_OIDC_COOKIE_KEYS=.*|CARTULAIRE_OIDC_COOKIE_KEYS=${cookie_key}|" \
  -e "s|^CARTULAIRE_API_DAEMON_SECRET=.*|CARTULAIRE_API_DAEMON_SECRET=${api_daemon_secret}|" \
  -e "s|^CARTULAIRE_DAEMON_INBOUND_SECRET=.*|CARTULAIRE_DAEMON_INBOUND_SECRET=${api_daemon_secret}|" \
  -e "s|^CARTULAIRE_CONNECTOR_MOCK_SECRET=.*|CARTULAIRE_CONNECTOR_MOCK_SECRET=${connector_secret}|" \
  -e "s|^MOCK_CONNECTOR_SECRET=.*|MOCK_CONNECTOR_SECRET=${connector_secret}|" \
  "$ENV_FILE"

printf '\033[32mCreated .env with openssl-generated secrets.\033[0m\n'
