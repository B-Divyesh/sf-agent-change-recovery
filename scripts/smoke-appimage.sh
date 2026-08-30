#!/usr/bin/env bash
set -euo pipefail

appimage="${1:?Usage: scripts/smoke-appimage.sh path/to/app.AppImage}"
if [ ! -s "$appimage" ]; then
  echo "AppImage was not found or is empty: $appimage" >&2
  exit 1
fi
if ! command -v xvfb-run >/dev/null; then
  echo "xvfb-run is required for the AppImage smoke test." >&2
  exit 1
fi

runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/change-recovery-appimage.XXXXXX")"
cleanup() {
  rm -rf "$runtime_dir"
}
trap cleanup EXIT

chmod +x "$appimage"
set +e
HOME="$runtime_dir/home" \
XDG_CONFIG_HOME="$runtime_dir/config" \
XDG_DATA_HOME="$runtime_dir/data" \
XDG_CACHE_HOME="$runtime_dir/cache" \
APPIMAGE_EXTRACT_AND_RUN=1 \
LIBGL_ALWAYS_SOFTWARE=1 \
timeout 12s xvfb-run -a "$appimage" >"$runtime_dir/output.log" 2>&1
status=$?
set -e

if [ "$status" -ne 124 ]; then
  sed -n '1,160p' "$runtime_dir/output.log" >&2
  echo "AppImage exited before the 12-second smoke window (status $status)." >&2
  exit 1
fi
if grep -E 'undefined symbol|Failed to load module|error while loading shared libraries' "$runtime_dir/output.log"; then
  echo "AppImage loaded an incompatible host library or module." >&2
  exit 1
fi

echo "AppImage remained running for 12 seconds without host-library module failures."
