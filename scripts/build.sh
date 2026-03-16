#!/usr/bin/env bash
#
# Build ove.run for the current platform.
# Outputs go to ./releases/
#
# Usage:
#   ./scripts/build.sh              # bump patch + build for current OS
#   BUMP=minor ./scripts/build.sh   # bump minor + build
#   BUMP=2.0.0 ./scripts/build.sh   # set exact version + build
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

# Auto-bump patch version
"$ROOT/scripts/bump-version.sh" "${BUMP:-patch}"
VERSION=$(grep -oP '"version":\s*"\K[^"]+' "$ROOT/package.json" | head -1)
echo "==> Building ove.run v$VERSION..."

# Build with Tauri (this runs beforeBuildCommand automatically)
# Allow partial failures (e.g. AppImage may fail if linuxdeploy isn't installed)
pnpm tauri build $TARGET_FLAG 2>&1 || echo "==> Warning: build exited non-zero (some bundle formats may have failed)"

# Collect artifacts into ./releases/ (clean first to avoid stale versions)
RELEASE_DIR="$ROOT/releases"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

BUNDLE_DIR="$ROOT/src-tauri/target/release/bundle"
if [[ -n "$TARGET_FLAG" ]]; then
    TARGET_TRIPLE="${2:-}"
    BUNDLE_DIR="$ROOT/src-tauri/target/$TARGET_TRIPLE/release/bundle"
fi

echo ""
echo "==> Collecting v$VERSION artifacts to ./releases/"

# Copy whatever bundle types were produced
for fmt in deb rpm appimage dmg msi nsis; do
    SRC="$BUNDLE_DIR/$fmt"
    if [[ -d "$SRC" ]]; then
        # Only copy files matching current version
        find "$SRC" -maxdepth 1 -type f -name "*${VERSION}*" -exec cp -v {} "$RELEASE_DIR/" \;
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
echo "==> Build complete. v$VERSION artifacts in ./releases/:"
ls -lh "$RELEASE_DIR/"
