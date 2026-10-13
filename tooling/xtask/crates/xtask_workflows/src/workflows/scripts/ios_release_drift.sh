set -euo pipefail
# A push landed on a PR that carries ios-update. Compare the native tree
# before and after the push (through the API: this works for force-pushes too
# and needs no checkout). Only native changes matter — web-only commits ship
# over the air after the merge.
tree_hash() {
  local sha=$1 part
  for part in ${NATIVE_TREE_PATH//\// }; do
    sha=$(gh api "repos/${GH_REPO}/git/trees/${sha}" --jq ".tree[] | select(.path == \"${part}\") | .sha" 2>/dev/null) || return 1
    [[ -n "$sha" ]] || return 1
  done
  echo "$sha"
}
before_tree=$(tree_hash "$BEFORE_SHA" || echo "unknown")
after_tree=$(tree_hash "$AFTER_SHA")
echo "native tree before: ${before_tree}"
echo "native tree after:  ${after_tree}"
if [[ "$before_tree" == "$after_tree" ]]; then
  echo "changed=false" >> "$GITHUB_OUTPUT"
  echo "No native changes in this push; the release stays valid."
else
  echo "changed=true" >> "$GITHUB_OUTPUT"
  echo "Native code changed; the released build is stale."
fi
