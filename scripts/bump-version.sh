#!/usr/bin/env bash
#
# Auto-increment version across package.json, tauri.conf.json, and Cargo.toml.
#
# Usage:
#   ./scripts/bump-version.sh          # bump patch (0.1.0 → 0.1.1)
#   ./scripts/bump-version.sh minor    # bump minor (0.1.5 → 0.2.0)
#   ./scripts/bump-version.sh major    # bump major (0.1.5 → 1.0.0)
#   ./scripts/bump-version.sh 2.0.0    # set exact version

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PKG="$ROOT/package.json"
TAURI="$ROOT/src-tauri/tauri.conf.json"
CARGO="$ROOT/src-tauri/Cargo.toml"

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

# Read current version from package.json
CURRENT=$(read_json_version "$PKG")
if [[ -z "$CURRENT" ]]; then
    echo "Error: could not read version from $PKG"
    exit 1
fi

TAURI_CURRENT=$(read_json_version "$TAURI")
CARGO_CURRENT=$(read_cargo_version "$CARGO")

BUMP="${1:-patch}"

case "$BUMP" in
    patch)
        require_semver "package.json" "$CURRENT"
        require_semver "tauri.conf.json" "$TAURI_CURRENT"
        require_semver "Cargo.toml" "$CARGO_CURRENT"

        if [[ "$CURRENT" != "$TAURI_CURRENT" || "$CURRENT" != "$CARGO_CURRENT" ]]; then
            echo "Error: version mismatch detected before bump"
            echo "  package.json: $CURRENT"
            echo "  tauri.conf.json: $TAURI_CURRENT"
            echo "  Cargo.toml: $CARGO_CURRENT"
            echo "Use: $0 X.Y.Z to resync them explicitly."
            exit 1
        fi

        IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
        PATCH=$((PATCH + 1))
        NEW="$MAJOR.$MINOR.$PATCH"
        ;;
    minor)
        require_semver "package.json" "$CURRENT"
        require_semver "tauri.conf.json" "$TAURI_CURRENT"
        require_semver "Cargo.toml" "$CARGO_CURRENT"

        if [[ "$CURRENT" != "$TAURI_CURRENT" || "$CURRENT" != "$CARGO_CURRENT" ]]; then
            echo "Error: version mismatch detected before bump"
            echo "  package.json: $CURRENT"
            echo "  tauri.conf.json: $TAURI_CURRENT"
            echo "  Cargo.toml: $CARGO_CURRENT"
            echo "Use: $0 X.Y.Z to resync them explicitly."
            exit 1
        fi

        IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
        MINOR=$((MINOR + 1))
        PATCH=0
        NEW="$MAJOR.$MINOR.$PATCH"
        ;;
    major)
        require_semver "package.json" "$CURRENT"
        require_semver "tauri.conf.json" "$TAURI_CURRENT"
        require_semver "Cargo.toml" "$CARGO_CURRENT"

        if [[ "$CURRENT" != "$TAURI_CURRENT" || "$CURRENT" != "$CARGO_CURRENT" ]]; then
            echo "Error: version mismatch detected before bump"
            echo "  package.json: $CURRENT"
            echo "  tauri.conf.json: $TAURI_CURRENT"
            echo "  Cargo.toml: $CARGO_CURRENT"
            echo "Use: $0 X.Y.Z to resync them explicitly."
            exit 1
        fi

        IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        NEW="$MAJOR.$MINOR.$PATCH"
        ;;
    *)
        if [[ ! "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Usage: $0 [patch|minor|major|X.Y.Z]"
            exit 1
        fi

        NEW="$BUMP"
        ;;
esac

if [[ "$CURRENT" == "$NEW" && "$TAURI_CURRENT" == "$NEW" && "$CARGO_CURRENT" == "$NEW" ]]; then
    echo "Version unchanged: $NEW"
    exit 0
fi

# Update package.json
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" "$PKG"

# Update tauri.conf.json
sed -i "s/\"version\": \"$TAURI_CURRENT\"/\"version\": \"$NEW\"/" "$TAURI"

# Update Cargo.toml (only the package version, not dependency versions)
sed -i "0,/^version = \"$CARGO_CURRENT\"/s/^version = \"$CARGO_CURRENT\"/version = \"$NEW\"/" "$CARGO"

echo "$CURRENT → $NEW"
