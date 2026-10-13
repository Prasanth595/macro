#!/usr/bin/env bash
# Sourced by linuxdeploy's AppRun before it launches the application.
export APPDIR="${APPDIR:-"$(dirname "$(realpath "$0")")"}"
export WEBKIT_INJECTED_BUNDLE_PATH="$APPDIR/usr/lib"
# Nix's libxkbcommon embeds a store path that does not exist on other distros.
export XKB_CONFIG_ROOT="$APPDIR/usr/share/X11/xkb"
# GIO's GNOME proxy resolver needs these schemas before WebKit starts networking.
export GSETTINGS_SCHEMA_DIR="$APPDIR/usr/share/glib-2.0/schemas"
gio_modules="$APPDIR/usr/lib/gio/modules"
if [ -d "$gio_modules" ]; then
  case ":${GIO_EXTRA_MODULES:-}:" in
    *:"$gio_modules":*) ;;
    *) export GIO_EXTRA_MODULES="$gio_modules${GIO_EXTRA_MODULES:+:$GIO_EXTRA_MODULES}" ;;
  esac
fi
