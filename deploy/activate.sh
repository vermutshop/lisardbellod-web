#!/bin/bash
set -euo pipefail
sha="${1:-}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid commit"; exit 1; }
base=/home/lisardbellod/apps
exec 9>"$base/deploy.lock"
flock -w 120 9
archive="$base/incoming/$sha.tar.gz"
release="$base/releases/$sha"
if [[ -e "$release" ]]; then
  if [[ "$(readlink "$base/current" || true)" == "$release" ]]; then
    curl --fail --silent http://127.0.0.1:3002/api/calculator-counter >/dev/null
    rm -f "$archive"
    echo "Release already active"
    exit 0
  fi
  echo "Release already exists; refusing to overwrite it"
  exit 1
fi
mkdir "$release"
tar -xzf "$archive" -C "$release" --no-same-owner
test -f "$release/public/index.html"
test -f "$release/deploy/api-server.mjs"
previous=$(readlink "$base/current" || true)
ln -s "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
sudo /usr/bin/systemctl restart lisardbellod-api.service || true
for attempt in {1..15}; do
  if curl --fail --silent http://127.0.0.1:3002/api/calculator-counter >/dev/null; then
    echo "Published $sha"
    rm "$archive"
    exit 0
  fi
  sleep 1
done
if [[ -n "$previous" ]]; then
  ln -s "$previous" "$base/current.next"
  mv -Tf "$base/current.next" "$base/current"
  sudo /usr/bin/systemctl restart lisardbellod-api.service
fi
echo "API verification failed; previous release restored" >&2
exit 1
