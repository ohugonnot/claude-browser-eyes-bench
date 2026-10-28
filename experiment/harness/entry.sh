#!/bin/sh
# Container entry point: relay localhost:8099 -> exp-relay:8099 (the only thing reachable), then run the command.
node /harness/tcprelay.js 8099 exp-relay 8099 &
exec "$@"
