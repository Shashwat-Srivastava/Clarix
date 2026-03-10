#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SKIP_LINT=false
SKIP_TEST=false
RUN_BOOTSTRAP=false

usage() {
  cat <<USAGE
Usage: ./scripts/build-dmg.sh [options]

Options:
  --bootstrap   Run bootstrap script before build
  --skip-lint   Skip lint step
  --skip-test   Skip test step
  -h, --help    Show this help
USAGE
}

log() {
  printf '[build] %s\n' "$1"
}

fail() {
  printf '[build] ERROR: %s\n' "$1" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bootstrap)
      RUN_BOOTSTRAP=true
      ;;
    --skip-lint)
      SKIP_LINT=true
      ;;
    --skip-test)
      SKIP_TEST=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
  shift
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "This script is for macOS only."
fi

cd "${PROJECT_ROOT}"

if [[ "${RUN_BOOTSTRAP}" == true ]]; then
  "${SCRIPT_DIR}/bootstrap-mac.sh"
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is required. Run ./scripts/bootstrap-mac.sh first."
fi

if [[ ! -d node_modules ]]; then
  log "node_modules not found. Running npm ci..."
  npm ci
fi

if [[ "${SKIP_LINT}" == false ]]; then
  log "Running lint..."
  npm run lint
else
  log "Skipping lint (--skip-lint)."
fi

if [[ "${SKIP_TEST}" == false ]]; then
  log "Running tests..."
  npm test
else
  log "Skipping tests (--skip-test)."
fi

log "Building DMG..."
npm run build

DMG_FILE="$(find release -maxdepth 1 -type f -name '*.dmg' | sort | tail -n 1)"
if [[ -z "${DMG_FILE}" ]]; then
  fail "Build finished but no DMG file was found in ./release."
fi

log "Build complete."
log "DMG: ${PROJECT_ROOT}/${DMG_FILE}"
