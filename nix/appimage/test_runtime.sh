#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd "$(dirname "$0")" && pwd)
hook="$source_dir/runtime-hook.sh"
data=${1:?usage: test_runtime.sh <bundled-xkb-data>}
smoke="$PWD/xkb-smoke"

# shellcheck disable=SC2046
cc -Wall -Wextra -Werror "$source_dir/test_xkb.c" $(pkg-config --cflags --libs xkbcommon) -o "$smoke"

# Prove that the fixture cannot silently fall back to the build host's data.
if env XKB_CONFIG_ROOT="$PWD/missing-xkb-data" "$smoke"; then
  echo "XKB smoke test unexpectedly used host keyboard data" >&2
  exit 1
fi

appdir="$PWD/Macro.AppDir"
mkdir -p "$appdir/usr/share/X11"
cp -r "$data" "$appdir/usr/share/X11/xkb"
printf '#!/usr/bin/env bash\nsource %q\nexec "$@"\n' "$hook" > "$appdir/AppRun"

# Normal AppImage startup supplies APPDIR; no caller workaround is necessary.
env -u XKB_CONFIG_ROOT APPDIR="$appdir" bash "$appdir/AppRun" "$smoke"

# It must still work after extraction/mounting at another path, including spaces,
# and override a stale inherited path rather than reaching back into /nix/store.
mv "$appdir" "$PWD/Relocated Macro.AppDir"
appdir="$PWD/Relocated Macro.AppDir"
env XKB_CONFIG_ROOT="$PWD/missing-xkb-data" APPDIR="$appdir" bash "$appdir/AppRun" "$smoke"

# linuxdeploy's standalone AppRun also works without the AppImage runtime env.
env -u APPDIR -u XKB_CONFIG_ROOT bash "$appdir/AppRun" "$smoke"
