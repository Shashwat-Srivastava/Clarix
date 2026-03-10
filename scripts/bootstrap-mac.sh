#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIN_NODE_MAJOR=20

log() {
  printf '[bootstrap] %s\n' "$1"
}

fail() {
  printf '[bootstrap] ERROR: %s\n' "$1" >&2
  exit 1
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "This script is for macOS only."
fi

if ! xcode-select -p >/dev/null 2>&1; then
  log "Xcode Command Line Tools are not installed. Triggering installer..."
  xcode-select --install || true
  fail "Install Xcode Command Line Tools, then rerun this script."
fi

if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    log "Node.js not found. Installing Node.js with Homebrew..."
    brew install node
  else
    fail "Node.js is required. Install Homebrew or Node.js (https://nodejs.org), then rerun."
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is not available. Reinstall Node.js and rerun."
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < MIN_NODE_MAJOR )); then
  log "Detected Node.js v$(node -v), but v${MIN_NODE_MAJOR}+ is recommended."
  if command -v brew >/dev/null 2>&1; then
    log "Upgrading Node.js via Homebrew..."
    brew upgrade node || true
  fi
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  if (( NODE_MAJOR < MIN_NODE_MAJOR )); then
    fail "Node.js v${MIN_NODE_MAJOR}+ is required. Current: $(node -v)."
  fi
fi

cd "${PROJECT_ROOT}"

if [[ -f package-lock.json ]]; then
  log "Installing project dependencies via npm ci..."
  npm ci
else
  log "package-lock.json not found. Installing dependencies via npm install..."
  npm install
fi

log "Bootstrap complete."
log "Next step: ./scripts/build-dmg.sh"
