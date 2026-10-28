#!/bin/bash
# Installs the npm packages used by the runs, into $RUN_DIR (needs Internet, once):
#   $RUN_DIR/pkgs     : @playwright/mcp 0.0.83 and chrome-devtools-mcp 1.12.0 (conditions C1 and C2)
#   $RUN_DIR/pkgs-pw  : playwright 1.64.1 (condition C3, `require('playwright')` inside pw-run)
# The browsers come with the Docker image; nothing else is downloaded.
# Usage: harness/setup.sh
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
install() {  # $1 = directory, remaining args = packages
  local d="$RUN_DIR/$1"; shift; mkdir -p "$d"
  docker run --rm --user "$DOCKER_USER" -e HOME=/tmp -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 -v "$d":/pkgs -w /pkgs "$IMG" \
    sh -c 'test -f package.json || npm init -y >/dev/null; npm install --no-audit --no-fund --save-exact "$@"' sh "$@"
}
install pkgs @playwright/mcp@0.0.83 chrome-devtools-mcp@1.12.0
install pkgs-pw playwright@1.64.1
