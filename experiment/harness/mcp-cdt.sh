#!/bin/bash
# Chrome DevTools MCP server (chrome-devtools-mcp 1.12.0) over stdio in Docker (headless, isolated, the image's Chromium).
# $1 = output directory (mounted at the same absolute path, for screenshots written with filePath).
# --executablePath avoids the "stable Chrome not found" error: the image has Chromium, not Chrome stable.
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
OUT="$1"; mkdir -p "$OUT"
exec docker run -i --rm --init --name "exp-mcp-cdt-$$" --user "$DOCKER_USER" --network exp-int --shm-size=1g \
  --memory 3g --cpus 2 -e HOME=/tmp -e TMPDIR="$OUT" \
  -v "$HARNESS":/harness:ro -v "$RUN_DIR/pkgs":/pkgs:ro -v "$OUT":"$OUT" "$IMG" \
  /harness/entry.sh node /pkgs/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js \
  --headless --isolated --no-usage-statistics --no-performance-crux \
  --executablePath "$CHROMIUM" --chromeArg=--no-sandbox
