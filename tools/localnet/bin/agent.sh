#!/usr/bin/env bash
# Per-worktree runner: boots an isolated Aztec local network on registry-claimed ports, runs the
# given command with AZTEC_NODE_URL / L1_RPC_URL / YACANA_RUN_ID set, tears down only what it
# owns. Usage: tools/localnet/bin/agent.sh <cmd> [args…]   e.g. tools/localnet/bin/agent.sh bun test packages/miner-core
set -euo pipefail
cd "$(dirname "$0")/../../.."
exec bun tools/localnet/src/isolated-node.ts -- "$@"
