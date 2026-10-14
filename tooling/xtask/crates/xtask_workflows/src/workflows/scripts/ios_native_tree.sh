# --- native tree ------------------------------------------------------------
# Hash identifying "the iOS native code" at a commit: every tracked blob under
# apps/web/tauri except the paths that never reach the iOS binary — the
# Android-only plugins (android-only cargo target dependencies), the desktop
# updater manifest, and editor config. The release stamps uploaded builds
# with it, the merge gate compares the live build's stamp against the merge
# result's, and the drift / head guards compare commits with it. Must match
# nativeTreeHash() in apps/web/scripts/ios-app-store.mjs and the iOS Native
# Check path filter (ios_native_check.rs).
NATIVE_TREE_PATH=apps/web/tauri
NATIVE_TREE_EXCLUDE='^(android_[^/]*/|desktop-release\.json$|\.helix/)'

# native_tree_hash <commit>: prints the hash, fails if the path is missing.
# (--full-tree: ls-tree otherwise narrows its output to the current directory,
# which would silently hash nothing when run from apps/web.)
native_tree_hash() {
  git rev-parse -q --verify "$1:${NATIVE_TREE_PATH}" >/dev/null || return 1
  git ls-tree -r --full-tree "$1:${NATIVE_TREE_PATH}" \
    | awk -F'\t' -v exclude="$NATIVE_TREE_EXCLUDE" '$2 !~ exclude' \
    | git hash-object --stdin
}

# native_tree_fetch <sha>: make a commit that is not in this checkout (a new
# PR head, GitHub's test merge commit, the pre-push head) available to
# native_tree_hash. Checkouts here don't persist credentials, so authenticate
# the way actions/checkout does. Fails if the commit is unreachable (a
# force-pushed-away head).
native_tree_fetch() {
  local auth
  auth=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')
  git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic ${auth}" \
    fetch -q --depth=1 origin "$1"
}
# ----------------------------------------------------------------------------
