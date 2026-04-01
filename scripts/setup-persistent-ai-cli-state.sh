#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AI_HOME_ROOT="${WORKSPACE_ROOT}/.ai-home"
CODEX_TARGET="${AI_HOME_ROOT}/codex"
CLAUDE_TARGET="${AI_HOME_ROOT}/claude"
WORKSPACE_BASHRC="${WORKSPACE_ROOT}/.config/bashrc"

mkdir -p "${CODEX_TARGET}" "${CLAUDE_TARGET}" "$(dirname "${WORKSPACE_BASHRC}")"

copy_into_target() {
  local source_path="$1"
  local target_path="$2"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --ignore-existing "${source_path}/" "${target_path}/"
    return 0
  fi

  if find "${source_path}" -mindepth 1 -maxdepth 1 | read -r _; then
    cp -a -n "${source_path}/." "${target_path}/"
  fi
}

backup_path_for() {
  local source_path="$1"
  local backup_path="${source_path}.pre-ai-home-backup"

  if [[ ! -e "${backup_path}" && ! -L "${backup_path}" ]]; then
    printf '%s\n' "${backup_path}"
    return 0
  fi

  printf '%s-%s\n' "${backup_path}" "$(date -u +%Y%m%dT%H%M%SZ)"
}

migrate_home_path() {
  local source_path="$1"
  local target_path="$2"

  mkdir -p "${target_path}"

  if [[ -L "${source_path}" ]]; then
    local resolved_target
    resolved_target="$(readlink -f "${source_path}" 2>/dev/null || true)"
    if [[ "${resolved_target}" != "${target_path}" ]]; then
      ln -sfn "${target_path}" "${source_path}"
    fi
    return 0
  fi

  if [[ -d "${source_path}" ]]; then
    copy_into_target "${source_path}" "${target_path}"
    local backup_path
    backup_path="$(backup_path_for "${source_path}")"
    mv "${source_path}" "${backup_path}"
    ln -s "${target_path}" "${source_path}"
    return 0
  fi

  if [[ -e "${source_path}" ]]; then
    local backup_path
    backup_path="$(backup_path_for "${source_path}")"
    mv "${source_path}" "${backup_path}"
    ln -s "${target_path}" "${source_path}"
    return 0
  fi

  ln -s "${target_path}" "${source_path}"
}

ensure_codex_config() {
  local config_path="${CODEX_TARGET}/config.toml"
  local temp_path
  temp_path="$(mktemp)"

  if [[ -f "${config_path}" ]]; then
    awk '
      BEGIN { updated = 0 }
      /^cli_auth_credentials_store[[:space:]]*=/ {
        if (!updated) {
          print "cli_auth_credentials_store = \"file\""
          updated = 1
        }
        next
      }
      { print }
      END {
        if (!updated) {
          print "cli_auth_credentials_store = \"file\""
        }
      }
    ' "${config_path}" > "${temp_path}"
  else
    printf 'cli_auth_credentials_store = "file"\n' > "${temp_path}"
  fi

  if [[ -f "${config_path}" ]] && cmp -s "${temp_path}" "${config_path}"; then
    rm -f "${temp_path}"
    return 0
  fi

  mv "${temp_path}" "${config_path}"
}

migrate_home_path "${HOME}/.codex" "${CODEX_TARGET}"
migrate_home_path "${HOME}/.claude" "${CLAUDE_TARGET}"
ensure_codex_config

chmod 700 "${AI_HOME_ROOT}" "${CODEX_TARGET}" "${CLAUDE_TARGET}"

printf 'Persistent Codex state: %s\n' "${CODEX_TARGET}"
printf 'Persistent Claude state: %s\n' "${CLAUDE_TARGET}"
printf 'Home Codex link: %s -> %s\n' "${HOME}/.codex" "$(readlink -f "${HOME}/.codex")"
printf 'Home Claude link: %s -> %s\n' "${HOME}/.claude" "$(readlink -f "${HOME}/.claude")"
