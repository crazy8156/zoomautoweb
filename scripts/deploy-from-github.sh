#!/usr/bin/env bash

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/zoom-elearning-web}"
BRANCH="${BRANCH:-main}"
PM2_APP_NAME="${PM2_APP_NAME:-zoom-elearning-web}"

cd "$REPO_DIR"

current_head="$(git rev-parse HEAD)"
git fetch origin "$BRANCH"
remote_head="$(git rev-parse "origin/$BRANCH")"

if [ "$current_head" = "$remote_head" ]; then
  echo "No new commit to deploy."
  exit 0
fi

echo "Deploying $remote_head"

needs_npm_ci=0
if ! git diff --quiet HEAD "origin/$BRANCH" -- package.json package-lock.json; then
  needs_npm_ci=1
fi

git reset --hard "origin/$BRANCH"

if [ "$needs_npm_ci" -eq 1 ]; then
  npm ci
fi

# Remove stale Next build artifacts so HTML and asset chunk names stay in sync.
rm -rf .next

npm run build
pm2 restart "$PM2_APP_NAME" --update-env

echo "Deployment complete: $remote_head"
