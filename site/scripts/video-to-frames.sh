#!/usr/bin/env bash
# Cuts a video into the WebP frame sequence the scroll film plays.
#   scripts/video-to-frames.sh my-film.mp4 [frames=240] [width=1280]
set -euo pipefail
cd "$(dirname "$0")/.."

IN=$1
COUNT=${2:-240}
WIDTH=${3:-1280}
OUT=public/film

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
FPS=$(awk "BEGIN{print $COUNT/$DUR}")

rm -rf "$OUT" && mkdir -p "$OUT"
TMP=$(mktemp -d)
ffmpeg -v error -i "$IN" -vf "fps=$FPS,scale=$WIDTH:-2" -frames:v "$COUNT" "$TMP/frame_%04d.png"
# Homebrew's ffmpeg has no WebP encoder, so convert with cwebp (brew install webp).
for f in "$TMP"/*.png; do
  cwebp -quiet -q 72 "$f" -o "$OUT/$(basename "${f%.png}").webp"
done
rm -rf "$TMP"

N=$(ls "$OUT" | wc -l | tr -d ' ')
SIZE=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$OUT/frame_0001.webp")
printf '{ "count": %d, "width": %d, "height": %d }\n' "$N" "${SIZE%,*}" "${SIZE#*,}" > "$OUT/manifest.json"
echo "Wrote $N frames ($(du -sh "$OUT" | cut -f1)) to $OUT"
