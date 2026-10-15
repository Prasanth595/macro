set -euo pipefail
# Last check before uploading: Android native code pushed to the PR while this
# run was building would make the bundle stale. The drift workflow cancels
# runs after the fact, but better not to upload at all. Compares the current
# PR head with the head that was built (this checkout).
built=$(bun scripts/android-native.mjs hash HEAD)
head_sha=$(gh pr view "$PR_NUMBER" --repo "$GH_REPO" --json headRefOid --jq '.headRefOid')
if [[ "$head_sha" == "$(git rev-parse HEAD)" ]]; then
  echo "PR head unchanged (${head_sha:0:10}); native hash ${built:0:10} is current."
  exit 0
fi
gh_fetch "$head_sha"
current=$(bun scripts/android-native.mjs hash "$head_sha")
if [[ "$current" == "$built" ]]; then
  echo "PR head moved to ${head_sha:0:10} but its Android native code is unchanged (${built:0:10}); uploading."
  exit 0
fi
echo "Android native code changed on PR #${PR_NUMBER} while this release was building" \
  "(${built:0:10} → ${current:0:10}). Not uploading the stale bundle." >&2
echo "Re-add the android-update label to release the current head." >&2
exit 1
