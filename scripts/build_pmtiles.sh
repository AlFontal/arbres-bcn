#!/usr/bin/env bash
set -euo pipefail

INPUT_PATH="${1:-data/processed/trees.geojsonseq}"
OUTPUT_PATH="${2:-public/data/trees.pmtiles}"
LAYER_NAME="${LAYER_NAME:-trees}"

if ! command -v tippecanoe >/dev/null 2>&1; then
  echo "tippecanoe is required but not installed." >&2
  echo "Install it first, for example on macOS: brew install tippecanoe" >&2
  exit 1
fi

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "Input file not found: $INPUT_PATH" >&2
  echo "Run: npm run prepare:data" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

tippecanoe \
  -fo "$OUTPUT_PATH" \
  -P \
  -Z0 \
  -z18 \
  --base-zoom=14 \
  --drop-densest-as-needed \
  --retain-points-multiplier=12 \
  --maximum-tile-bytes=1500000 \
  --extend-zooms-if-still-dropping \
  -l "$LAYER_NAME" \
  "$INPUT_PATH"

echo "Wrote $OUTPUT_PATH"
