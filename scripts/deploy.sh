#!/usr/bin/env bash
# Publish the app to GitHub Pages: test, build for the /mahjong-scorekeeper/ sub-path,
# then force-push the built files to the gh-pages branch, which Pages serves.
# Usage: npm run deploy
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npx vitest run
BASE_PATH=/mahjong-scorekeeper/ npm run build
touch dist/.nojekyll # serve files as-is (no Jekyll processing)

REMOTE="$(git remote get-url origin)"
SOURCE="$(git rev-parse --short HEAD)"
TMP="$(mktemp -d)"
cp -R dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy ${SOURCE}"
git push -q -f "$REMOTE" gh-pages
cd "$ROOT"
rm -rf "$TMP"
echo "Published ${SOURCE}. GitHub Pages updates in about a minute."
