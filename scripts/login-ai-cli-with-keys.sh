#!/usr/bin/env bash

set -euo pipefail

HOME_DIR="${HOME}"
CODEX_AUTH_FILE="${HOME_DIR}/.codex/auth.json"
CLAUDE_LOGIN_SCRIPT="$(command -v claude 2>/dev/null || true)"

login_with_openai_key() {
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    return 0
  fi

  if [[ -f "${CODEX_AUTH_FILE}" ]] && grep -q '"auth_mode"\s*:\s*"api_key"' "${CODEX_AUTH_FILE}"; then
    return 0
  fi

  printf '%s\n' "${OPENAI_API_KEY}" | codex login --with-api-key >/dev/null 2>&1
}

login_with_anthropic_key() {
  if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    return 0
  fi

  if [[ -n "${CLAUDE_LOGIN_SCRIPT}" ]] && claude auth status >/dev/null 2>&1; then
    if claude auth status | grep -q '"authMethod"\s*:\s*"api_key"'; then
      return 0
    fi
  fi

  claude auth login --apikey "${ANTHROPIC_API_KEY}" >/dev/null 2>&1
}

login_with_openai_key
login_with_anthropic_key
