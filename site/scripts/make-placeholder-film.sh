#!/usr/bin/env bash
# Builds a placeholder product film from the stills in ../original-photos:
# slow push-ins on each shot, cross-dissolves, dark warm grade.
# Swap in a real (e.g. AI-generated) film later with video-to-frames.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=../original-photos
OUT=${1:-film-src/placeholder.mp4}
FPS=24
SHOT=66      # frames per shot
FADE=0.8     # cross-dissolve, seconds
TMP=$(mktemp -d)
mkdir -p "$(dirname "$OUT")"

# shot: <photo> <zoom start> <zoom end> <focus x 0-1> <focus y 0-1>
# Focus is a point on the photo the camera drifts toward.
shot() {
  local i=$1 img=$2 zs=$3 ze=$4 fx=$5 fy=$6
  # 16:9 plate: blurred, darkened copy of the photo behind the sharp photo.
  ffmpeg -v error -y -i "$SRC/$img" -filter_complex "
    [0]split[a][b];
    [a]scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,boxblur=40:2,eq=brightness=-0.32:saturation=0.6[bg];
    [b]scale=-2:2160[fg];
    [bg][fg]overlay=(W-w)/2:0" "$TMP/plate$i.png"
  local fgw
  fgw=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$SRC/$img" | awk -F, '{printf "%d", 2160*$1/$2}')
  [ "$fgw" -gt 3840 ] && fgw=3840
  # Focus point in plate pixels.
  local px py
  px=$(awk "BEGIN{print (3840-$fgw)/2 + $fx*$fgw}")
  py=$(awk "BEGIN{print $fy*2160}")
  # Smoothstep ease on the zoom, camera centre glides from frame centre to focus.
  local t="(on/$((SHOT-1)))" e
  e="($t*$t*(3-2*$t))"
  ffmpeg -v error -y -loop 1 -i "$TMP/plate$i.png" -vf "
    zoompan=z='$zs+($ze-$zs)*$e':
      x='max(0,min(iw-iw/zoom,(1920+($px-1920)*$e)-iw/zoom/2))':
      y='max(0,min(ih-ih/zoom,(1080+($py-1080)*$e)-ih/zoom/2))':
      d=$SHOT:s=1920x1080:fps=$FPS,
    trim=end_frame=$SHOT,format=yuv420p" "$TMP/shot$i.mp4"
}

shot 0 hero.jpg        1.00 1.30 0.50 0.42
shot 1 coat-camel.jpg  1.15 2.10 0.42 0.32
shot 2 coat-belted.jpg 1.20 2.40 0.50 0.30
shot 3 linen.jpg       1.00 1.55 0.50 0.50
shot 4 hero.jpg        2.40 1.00 0.48 0.40

# Chain the shots with cross-dissolves.
LEN=$(awk "BEGIN{print $SHOT/$FPS}")
inputs="" ; chain="" ; prev="[0]"
for i in 0 1 2 3 4; do inputs+=" -i $TMP/shot$i.mp4"; done
for i in 1 2 3 4; do
  off=$(awk "BEGIN{print $i*($LEN-$FADE)}")
  chain+="$prev[$i]xfade=transition=fade:duration=$FADE:offset=$off[v$i];"
  prev="[v$i]"
done
ffmpeg -v error -y $inputs -filter_complex "${chain}${prev}
  eq=contrast=1.12:brightness=-0.06:saturation=0.82,
  colorbalance=rs=0.04:bs=-0.05,
  vignette=angle=PI/3.6[out]" -map "[out]" -c:v libx264 -crf 16 -pix_fmt yuv420p "$OUT"

rm -rf "$TMP"
echo "Wrote $OUT"
