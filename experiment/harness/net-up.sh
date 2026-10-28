#!/bin/bash
# Creates the internal Docker network (no route to the Internet) and the relay container towards the page server.
# The relay sits on the default bridge AND on the internal network; it forwards only port 8099 of the host.
# Prerequisite: the page is served on the host at http://localhost:8099/ (see ../README.md).
# Usage: harness/net-up.sh            (idempotent; recreates the relay if it is gone)
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
docker network inspect exp-int >/dev/null 2>&1 || docker network create --internal exp-int >/dev/null
if ! docker ps --format '{{.Names}}' | grep -qx exp-relay; then
  docker rm -f exp-relay >/dev/null 2>&1
  GW=$(docker network inspect bridge -f '{{(index .IPAM.Config 0).Gateway}}')
  docker run -d --name exp-relay --user "$DOCKER_USER" -v "$HARNESS":/harness:ro "$IMG" node /harness/tcprelay.js 8099 "$GW" 8099 all >/dev/null
  docker network connect exp-int exp-relay
fi
docker ps --filter name=exp-relay --format '{{.Names}} {{.Status}}'
