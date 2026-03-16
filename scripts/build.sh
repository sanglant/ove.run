#!/usr/bin/env bash
#
# Build ove.run for the current platform.
# Outputs go to ./release/<target>/
#
# Usage:
#   ./scripts/build.sh              # build for current OS
#   ./scripts/build.sh --target x86_64-pc-windows-msvc   # cross-compile (requires toolchain)
#
# Supported targets (must be built on each respective OS or via CI):
#   Linux:   x86_64-unknown-linux-gnu  (deb, AppImage, rpm)
#   macOS:   x86_64-apple-darwin, aarch64-apple-darwin (dmg, app bundle)
#   Windows: x86_64-pc-windows-msvc (msi, nsis)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET_FLAG=""
if [[ "${1:-}" == "--target" && -n "${2:-}" ]]; then
    TARGET_FLAG="--target $2"
fi

echo "==> Building ove.run release..."

# Build with Tauri (this runs beforeBuildCommand automatically)
# Allow partial failures (e.g. AppImage may fail if linuxdeploy isn't installed)
pnpm tauri build $TARGET_FLAG 2>&1 || echo "==> Warning: build exited non-zero (some bundle formats may have failed)"

# Collect artifacts into ./release/
RELEASE_DIR="$ROOT/release"
mkdir -p "$RELEASE_DIR"

BUNDLE_DIR="$ROOT/src-tauri/target/release/bundle"
if [[ -n "$TARGET_FLAG" ]]; then
    TARGET_TRIPLE="${2:-}"
    BUNDLE_DIR="$ROOT/src-tauri/target/$TARGET_TRIPLE/release/bundle"
fi

echo ""
echo "==> Copying artifacts to ./release/"

# Copy whatever bundle types were produced
for fmt in deb rpm appimage dmg msi nsis; do
    SRC="$BUNDLE_DIR/$fmt"
    if [[ -d "$SRC" ]]; then
        cp -v "$SRC"/* "$RELEASE_DIR/" 2>/dev/null || true
    fi
done

# Also copy the raw binary
BINARY="$ROOT/src-tauri/target/release/ove-run"
if [[ -n "$TARGET_FLAG" ]]; then
    BINARY="$ROOT/src-tauri/target/${2:-}/release/ove-run"
fi
if [[ -f "$BINARY" ]]; then
    cp -v "$BINARY" "$RELEASE_DIR/"
elif [[ -f "$BINARY.exe" ]]; then
    cp -v "$BINARY.exe" "$RELEASE_DIR/"
fi

echo ""
echo "==> Build complete. Artifacts in ./release/:"
ls -lh "$RELEASE_DIR/"
