#!/usr/bin/env bash
# Install rea-harness into the current project.
#
# Usage:
#   ./install.sh [onboard flags...]
#   ./install.sh --with-rea
#
# From a clone it runs the local engine. Elsewhere it fetches the private repository with npx, so
# the caller needs GitHub credentials for igutiez/rea-harness.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$here/scripts/rsc.js" ] && [ -f "$here/package.json" ]; then
  exec node "$here/scripts/rsc.js" onboard "$@"
fi
exec npx -y github:igutiez/rea-harness onboard "$@"
