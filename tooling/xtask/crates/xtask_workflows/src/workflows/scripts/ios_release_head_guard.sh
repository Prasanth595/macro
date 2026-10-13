set -euo pipefail
# Last check before submitting for review: native code pushed to the PR while
# this run was building would make the uploaded build stale. The drift
# workflow withdraws submissions after the fact, but better not to submit at
# all. Compares the native tree of the PR's current head (through the API —
# this checkout is the head the run started from) with the tree that was
# built.
built_tree=$(git rev-parse "HEAD:${NATIVE_TREE_PATH}")
built=$(jq -r '.bundle.iOS.bundleVersion' apps/web/tauri/src-tauri/tauri.ios.conf.json)
head_sha=$(gh pr view "$PR_NUMBER" --repo "$GH_REPO" --json headRefOid --jq '.headRefOid')
if [[ "$head_sha" == "$(git rev-parse HEAD)" ]]; then
  echo "PR head unchanged (${head_sha:0:10}); native tree ${built_tree:0:10} is current."
  exit 0
fi
sha=$head_sha
for part in ${NATIVE_TREE_PATH//\// }; do
  sha=$(gh api "repos/${GH_REPO}/git/trees/${sha}" --jq ".tree[] | select(.path == \"${part}\") | .sha")
  [[ -n "$sha" ]] || { echo "Could not resolve ${NATIVE_TREE_PATH} at ${head_sha}" >&2; exit 1; }
done
if [[ "$sha" == "$built_tree" ]]; then
  echo "PR head moved to ${head_sha:0:10} but its native tree is still ${built_tree:0:10}; submitting."
  exit 0
fi
echo "Native code changed on PR #${PR_NUMBER} while this release was building" \
  "(tree ${built_tree:0:10} → ${sha:0:10}). Not submitting the stale build ${built}." >&2
echo "Bump (doppler run --project ios-release --config prd -- just ios-bump), commit," \
  "and re-add the ios-update label to release the current head." >&2
exit 1
