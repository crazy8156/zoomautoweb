#!/usr/bin/env bash

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/zoom-elearning-web}"
BRANCH="${BRANCH:-main}"
PM2_APP_NAME="${PM2_APP_NAME:-zoom-elearning-web}"
LOCAL_URL="${LOCAL_URL:-http://127.0.0.1:3010}"

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

# Clear Next's incremental cache, but keep the current production assets in
# place while the live process is still serving requests.
rm -rf .next/cache

npm run build
pm2 restart "$PM2_APP_NAME" --update-env

sleep 5

css_paths="$(curl -fsSL "$LOCAL_URL" | grep -o '/_next/static/chunks/[^" ]*\.css' | sort -u)"
if [ -z "$css_paths" ]; then
  echo "Post-deploy check failed: no CSS chunk found in $LOCAL_URL" >&2
  exit 1
fi

for css_path in $css_paths; do
  curl -fsSI "$LOCAL_URL$css_path" >/dev/null
done

echo "Deployment complete: $remote_head"
