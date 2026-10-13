set -euo pipefail
# The ios-update label means "release this and merge it when Apple approves",
# so refuse to start unless the PR is in a mergeable state: not a draft, and
# every other check on the head commit passing. Pending checks are waited on
# (the label often lands right after a push); anything failing stops the
# release before the long build. Our own checks are excluded: the native
# check is expected to be red until the release is live.
pr_json=$(gh pr view "$PR_NUMBER" --repo "$GH_REPO" --json isDraft,headRefOid)
if [[ "$(jq -r '.isDraft' <<<"$pr_json")" == "true" ]]; then
  echo "PR #${PR_NUMBER} is a draft; mark it ready for review before adding ios-update." >&2
  exit 1
fi
head_sha=$(jq -r '.headRefOid' <<<"$pr_json")
if [[ "$head_sha" != "$HEAD_SHA" ]]; then
  # Pushed since the label event. Web-only commits are fine (they ship over
  # the air after the merge); native ones would make this build stale.
  tree_hash() {
    local sha=$1 part
    for part in ${NATIVE_TREE_PATH//\// }; do
      sha=$(gh api "repos/${GH_REPO}/git/trees/${sha}" --jq ".tree[] | select(.path == \"${part}\") | .sha")
      [[ -n "$sha" ]] || return 1
    done
    echo "$sha"
  }
  if [[ "$(tree_hash "$head_sha")" != "$(git rev-parse "HEAD:${NATIVE_TREE_PATH}")" ]]; then
    echo "PR #${PR_NUMBER} got native changes since this run started (${HEAD_SHA:0:10} → ${head_sha:0:10});" \
      "re-add ios-update on the current head." >&2
    exit 1
  fi
  echo "PR #${PR_NUMBER} moved to ${head_sha:0:10} since this run started, but its native code is unchanged; continuing."
fi

ours='^(iOS Native Check|iOS App Store Release|Enable auto-merge|iOS Release Drift)'
deadline=$(( $(date +%s) + WAIT_MINUTES * 60 ))
while true; do
  checks=$(gh pr checks "$PR_NUMBER" --repo "$GH_REPO" --json name,bucket \
    | jq -c --arg ours "$ours" '[.[] | select(.name | test($ours) | not)]')
  failing=$(jq -r '[.[] | select(.bucket == "fail" or .bucket == "cancel") | .name] | join(", ")' <<<"$checks")
  pending=$(jq -r '[.[] | select(.bucket == "pending") | .name] | join(", ")' <<<"$checks")
  if [[ -n "$failing" ]]; then
    echo "PR #${PR_NUMBER} has failing checks: ${failing}. Get the PR green, then re-add ios-update." >&2
    exit 1
  fi
  if [[ -z "$pending" ]]; then
    echo "All other checks on ${head_sha:0:10} pass ($(jq 'length' <<<"$checks") checks)."
    exit 0
  fi
  if (( $(date +%s) > deadline )); then
    echo "Checks still pending after ${WAIT_MINUTES} minutes: ${pending}. Re-add ios-update once they pass." >&2
    exit 1
  fi
  echo "Waiting for: ${pending}"
  sleep 60
done
