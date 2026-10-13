#!/usr/bin/env bash
set -euo pipefail
helpers=${1:?usage: test_xdg.sh <portable-xdg-utils>}

# Help/version alone would miss the awk/sed/data paths used by real operations.
if grep -n /nix/store/ "$helpers/bin/xdg-open" "$helpers/bin/xdg-mime"; then
  echo 'Desktop helpers still depend on the Nix store' >&2
  exit 1
fi

export HOME="$PWD/xdg-home" XDG_CONFIG_HOME="$PWD/xdg-config"
export XDG_DATA_HOME="$PWD/xdg-data" XDG_DATA_DIRS="$PWD/xdg-system-data"
unset DISPLAY WAYLAND_DISPLAY DESKTOP_SESSION KDE_FULL_SESSION GNOME_DESKTOP_SESSION_ID
export XDG_CURRENT_DESKTOP=X-Generic
mkdir -p "$HOME" "$XDG_CONFIG_HOME" "$XDG_DATA_HOME/applications" "$XDG_DATA_DIRS" "$PWD/fake-bin"
printf '[Desktop Entry]\nType=Application\nName=AppImage test\nExec=true\nMimeType=x-scheme-handler/macro-appimage-test;\n' \
  > "$XDG_DATA_HOME/applications/macro-appimage-test.desktop"

export PATH="$helpers/bin:$PATH"
xdg-mime --version
xdg-open --help >/dev/null
xdg-mime default macro-appimage-test.desktop x-scheme-handler/macro-appimage-test
test "$(xdg-mime query default x-scheme-handler/macro-appimage-test)" = macro-appimage-test.desktop

# Test browser dispatch without a display, session bus, network, or real browser.
# The generated script expands its arguments and log path when it runs.
# shellcheck disable=SC2016
printf '#!%s\nprintf "%%s\\n" "$@" > "$XDG_TEST_BROWSER_LOG"\n' "$BASH" > "$PWD/fake-bin/macro-test-browser"
chmod +x "$PWD/fake-bin/macro-test-browser"
export PATH="$PWD/fake-bin:$PATH" BROWSER=macro-test-browser XDG_TEST_BROWSER_LOG="$PWD/browser-args"
url='https://example.invalid/appimage-test?a=1&b=2'
xdg-open "$url"
test "$(< "$XDG_TEST_BROWSER_LOG")" = "$url"
echo 'Portable desktop helpers registered/queried a MIME handler and dispatched a URL'
