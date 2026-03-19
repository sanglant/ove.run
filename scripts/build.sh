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

read_json_version() {
    local file="$1"
    grep -oP '"version":\s*"\K[^"]+' "$file" | head -1
}

read_cargo_version() {
    local file="$1"
    grep -m1 -oP '^version = "\K[^"]+' "$file"
}

require_semver() {
    local label="$1"
    local version="$2"

    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Error: $label version must match X.Y.Z, got '$version'"
        exit 1
    fi
}

read_versions() {
    PACKAGE_VERSION=$(read_json_version "$ROOT/package.json")
    TAURI_VERSION=$(read_json_version "$ROOT/src-tauri/tauri.conf.json")
    CARGO_VERSION=$(read_cargo_version "$ROOT/src-tauri/Cargo.toml")

    require_semver "package.json" "$PACKAGE_VERSION"
    require_semver "tauri.conf.json" "$TAURI_VERSION"
    require_semver "Cargo.toml" "$CARGO_VERSION"

    if [[ "$PACKAGE_VERSION" != "$TAURI_VERSION" || "$PACKAGE_VERSION" != "$CARGO_VERSION" ]]; then
        echo "Error: version mismatch detected"
        echo "  package.json: $PACKAGE_VERSION"
        echo "  tauri.conf.json: $TAURI_VERSION"
        echo "  Cargo.toml: $CARGO_VERSION"
        exit 1
    fi

    VERSION="$PACKAGE_VERSION"
}

TARGET_FLAG=""
if [[ "${1:-}" == "--target" && -n "${2:-}" ]]; then
    TARGET_FLAG="--target $2"
fi

# Auto-bump patch version
"$ROOT/scripts/bump-version.sh" "${BUMP:-patch}"
read_versions
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
COPIED_ARTIFACTS=0
for fmt in deb rpm appimage dmg msi nsis; do
    SRC="$BUNDLE_DIR/$fmt"
    if [[ -d "$SRC" ]]; then
        # Only copy files matching current version
        while IFS= read -r artifact; do
            cp -v "$artifact" "$RELEASE_DIR/"
            COPIED_ARTIFACTS=$((COPIED_ARTIFACTS + 1))
        done < <(find "$SRC" -maxdepth 1 -type f -name "*${VERSION}*" | sort)
    fi
done

if [[ "$COPIED_ARTIFACTS" -eq 0 ]]; then
    echo "==> Warning: no bundled artifacts matched version $VERSION in $BUNDLE_DIR"
    find "$BUNDLE_DIR" -maxdepth 2 -type f | sort || true
fi

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
