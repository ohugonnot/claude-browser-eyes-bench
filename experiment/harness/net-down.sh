#!/bin/bash
# Removes the relay container and the internal network created by net-up.sh.
docker rm -f exp-relay >/dev/null 2>&1
docker network rm exp-int >/dev/null 2>&1
echo "relay and network removed"
