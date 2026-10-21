set -euo pipefail

nix path-info --derivation \
  ".#packages.aarch64-darwin.tauri-desktop-cef-app" \
  > "$RUNNER_TEMP/desktop-cache-roots"

nix build --option sandbox false --print-build-logs \
  ".#packages.aarch64-darwin.tauri-desktop-cef-app"

app=result/Macro.app
framework="$app/Contents/Frameworks/Chromium Embedded Framework.framework"
test -x "$app/Contents/MacOS/app"
test -s "$framework/Chromium Embedded Framework"

helpers=("$app"/Contents/Frameworks/*.app)
if [ "${#helpers[@]}" -lt 5 ]; then
  echo "Chromium helper apps missing from $app" >&2
  exit 1
fi
for helper in "${helpers[@]}"; do
  test -x "$helper/Contents/MacOS/$(basename "$helper" .app)"
done
