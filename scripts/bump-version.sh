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

# Read current version from package.json
CURRENT=$(grep -oP '"version":\s*"\K[^"]+' "$PKG" | head -1)
if [[ -z "$CURRENT" ]]; then
    echo "Error: could not read version from $PKG"
    exit 1
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

BUMP="${1:-patch}"

case "$BUMP" in
    patch)
        PATCH=$((PATCH + 1))
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    [0-9]*)
        # Exact version provided
        IFS='.' read -r MAJOR MINOR PATCH <<< "$BUMP"
        ;;
    *)
        echo "Usage: $0 [patch|minor|major|X.Y.Z]"
        exit 1
        ;;
esac

NEW="$MAJOR.$MINOR.$PATCH"

if [[ "$CURRENT" == "$NEW" ]]; then
    echo "Version unchanged: $NEW"
    exit 0
fi

# Update package.json
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" "$PKG"

# Update tauri.conf.json
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" "$TAURI"

# Update Cargo.toml (only the package version, not dependency versions)
sed -i "0,/^version = \"$CURRENT\"/s/^version = \"$CURRENT\"/version = \"$NEW\"/" "$CARGO"

echo "$CURRENT → $NEW"
