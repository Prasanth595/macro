#!/bin/bash
set -euo pipefail

icon_dir="$(\cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
output_dir="$(mktemp -d)"
trap 'rm -rf "$output_dir"' EXIT

xcrun actool "$icon_dir/Macro.icon" \
  --compile "$output_dir" \
  --platform macosx \
  --minimum-deployment-target 10.13 \
  --app-icon Macro \
  --output-partial-info-plist "$output_dir/Info.plist" \
  --output-format human-readable-text

cp "$output_dir/Assets.car" "$output_dir/Macro.icns" "$icon_dir/"
# Info.plist also holds the camera and microphone usage strings, so update
# only the icon keys actool generates.
for key in CFBundleIconFile CFBundleIconName; do
  plutil -replace "$key" -string "$(plutil -extract "$key" raw "$output_dir/Info.plist")" \
    "$icon_dir/Info.plist"
done
