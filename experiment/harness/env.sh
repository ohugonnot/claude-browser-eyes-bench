# Common settings, sourced by the other scripts.
#
# Layout (all paths derive from the location of this file, nothing is hard-coded):
#   EXP      = experiment/            (parent of this harness/ directory)
#   RUN_DIR  = where everything generated goes: cwd/, runs/, reports/, overhead/, work/, mcp-out/,
#              pkgs/, pkgs-pw/, generated/, blind/, summary.json.
#              Default: experiment/run/ (git-ignored). Override with EXP_RUN_DIR=/some/dir.
#   SITE_DIR = the page under test, read by condition C0 (sources only).
#              Default: the repository's site/ directory. Override with SITE_DIR=/some/dir.
# Docker is called as the current user (override with DOCKER_USER=uid:gid). If your user is not in the
# docker group, run the scripts through `sudo` or `sg docker -c '...'`.
HARNESS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXP="$(dirname "$HARNESS")"
RUN_DIR="${EXP_RUN_DIR:-$EXP/run}"
mkdir -p "$RUN_DIR"; RUN_DIR="$(cd "$RUN_DIR" && pwd)"
SITE_DIR="${SITE_DIR:-$(dirname "$EXP")/site}"
SITE_DIR="$(cd "$SITE_DIR" && pwd)"
DOCKER_USER="${DOCKER_USER:-$(id -u):$(id -g)}"
IMG="${EXP_IMAGE:-mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea}"
CHROMIUM=/ms-playwright/chromium-1248/chrome-linux64/chrome   # Chromium shipped in the image above
