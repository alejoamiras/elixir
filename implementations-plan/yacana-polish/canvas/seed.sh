#!/usr/bin/env bash
# Seeds the design canvas from the artboards (gen.py first) into the scratchpad and checks it.
#   bash implementations-plan/yacana-polish/canvas/seed.sh <out.html>
set -eu
cd "$(dirname "$0")"
OUT=${1:?out html}
D=/home/homelab/.cache/tmp/claude-1000/bundled-skills/2.1.267/b94cb6ac28ed91951da0335df93fc991/design
args=()
for f in *.dc.html; do args+=(--artboard "$f"); done
node "$D/seed-canvas.mjs" --template "$D/payload.template.html" --out "$OUT" --title "Yacana Polish" "${args[@]}" --canvas canvas.json
node "$D/seed-canvas.mjs" --check "$OUT"
