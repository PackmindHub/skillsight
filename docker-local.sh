#!/usr/bin/env bash
# Build a local production-iso Docker image of skillsight.
# Mirrors .github/workflows/release.yml (version-sync check + Dockerfile build)
# but stays local: host arch, no push, no registry prefix.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

read_version() {
  bun -e "console.log(JSON.parse(await Bun.file('$1').text()).version)"
}

VERSION="$(read_version package.json)"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: root package.json version '$VERSION' is not x.y.z" >&2
  exit 1
fi

for f in package.json backend/package.json frontend/package.json; do
  actual="$(read_version "$f")"
  if [[ "$actual" != "$VERSION" ]]; then
    echo "error: $f version '$actual' != root '$VERSION'. Run 'bun run version:sync' first." >&2
    exit 1
  fi
  echo "$f OK ($actual)"
done

IMAGE_NAME="skillsight"
echo "Building $IMAGE_NAME:$VERSION (host arch)..."
docker build \
  --file Dockerfile \
  --tag "$IMAGE_NAME:$VERSION" \
  --tag "$IMAGE_NAME:local" \
  .

cat <<EOF

Built:
  $IMAGE_NAME:$VERSION
  $IMAGE_NAME:local

Run locally:
  SKILLSIGHT_IMAGE=$IMAGE_NAME:local docker compose up -d
EOF
