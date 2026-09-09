#!/usr/bin/env bash
# Installs the pinned headless Presto (`presto-server`) for the miner's live test and its e2e lane.
# The release and every asset's SHA-256 are committed here: a checksum fetched beside the binary
# would only guard against corruption, not against a replaced release. Every run downloads and
# verifies the archive: a binary already in place is not trusted on the strength of its own output.
#   scripts/run/install-presto-server.sh [dest-dir]   (default ~/.local/bin; CI passes the runner's PATH dir)
set -euo pipefail

VERSION="1.1.1"
TAG="presto-v${VERSION}"
REPO="alejoamiras/presto"
DEST="${1:-$HOME/.local/bin}"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)  ASSET="presto-server-${VERSION}-linux-x86_64.tar.gz";  SHA="48f524b159fe84947f767ca2903e06c82eb555eec99ab46052cb3d92bd1b33ef" ;;
  Linux-aarch64) ASSET="presto-server-${VERSION}-linux-arm64.tar.gz";   SHA="bb65f8c93556cb348a7061ddeff8a98e1bee5ac34e46cd109e5973ab1dec8639" ;;
  Darwin-arm64)  ASSET="presto-server-${VERSION}-macos-arm64.tar.gz";   SHA="b3efa1d897b1a380b669d630ca52b1b41fe927a8b21bfafaf80f45d330a468b9" ;;
  Darwin-x86_64) ASSET="presto-server-${VERSION}-macos-x86_64.tar.gz";  SHA="27dc1100c5fb9acb02e5349b2317b28bdeefa6d23e0a8f6f92c4a1a287124a13" ;;
  *) echo "no presto-server ${VERSION} build for $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
curl -fsSL --retry 3 -o "$WORK/$ASSET" "https://github.com/${REPO}/releases/download/${TAG}/${ASSET}"
echo "${SHA}  $WORK/$ASSET" | sha256sum -c - >/dev/null
tar -xzf "$WORK/$ASSET" -C "$WORK"
BIN="$(find "$WORK" -type f -name 'presto-server*' ! -name '*.tar.gz' | head -1)"
[ -n "$BIN" ] || { echo "the archive holds no presto-server binary" >&2; exit 1; }
mkdir -p "$DEST"
install -m 0755 "$BIN" "$DEST/presto-server"
echo "presto-server ${VERSION} → $DEST/presto-server"
