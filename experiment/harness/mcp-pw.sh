#!/bin/bash
# Playwright MCP server (@playwright/mcp 0.0.83) over stdio in Docker, started by claude through --mcp-config.
# $1 = output directory for screenshots/snapshots (mounted at the same absolute path as on the host).
# Internal network without Internet; localhost:8099 is relayed to the test page (see entry.sh).
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
OUT="$1"; mkdir -p "$OUT"
exec docker run -i --rm --init --name "exp-mcp-pw-$$" --user "$DOCKER_USER" --network exp-int --shm-size=1g \
  --memory 3g --cpus 2 -e HOME=/tmp \
  -v "$HARNESS":/harness:ro -v "$RUN_DIR/pkgs":/pkgs:ro -v "$OUT":"$OUT" "$IMG" \
  /harness/entry.sh node /pkgs/node_modules/@playwright/mcp/cli.js \
  --headless --isolated --no-sandbox --browser chromium --executable-path "$CHROMIUM" --output-dir "$OUT"
