set -euo pipefail
# For each open PR labeled `ios-update` (PRS: [{number, sha}]), ask App Store
# Connect whether the iOS version + build committed at the PR head is live.
# When it is, and the PR's latest `iOS Native Check` run failed (it fails
# until the release is live), re-run that run so the gate goes green without
# anyone clicking "Re-run". GH_TOKEN needs actions:write + pull-requests:write.
cd apps/web
conf_path="apps/web/tauri/src-tauri/tauri.ios.conf.json"

# Git tree hash of a path at a commit, via the API (this checkout is main, not
# the PR head): walks the tree one path component at a time.
tree_hash() {
  local sha=$1 part
  for part in ${2//\// }; do
    sha=$(gh api "repos/${GH_REPO}/git/trees/${sha}" --jq ".tree[] | select(.path == \"${part}\") | .sha")
    [[ -n "$sha" ]] || return 1
  done
  echo "$sha"
}

jq -c '.[]' <<<"$PRS" | while read -r pr; do
  number=$(jq -r '.number' <<<"$pr")
  sha=$(jq -r '.sha' <<<"$pr")
  conf=$(gh api "repos/${GH_REPO}/contents/${conf_path}?ref=${sha}" --jq '.content' | base64 --decode)
  version=$(jq -r '.version' <<<"$conf")
  build=$(jq -r '.bundle.iOS.bundleVersion' <<<"$conf")
  native_tree=$(tree_hash "$sha" "apps/web/tauri")
  echo "PR #${number}: iOS ${version} (build ${build}) at ${sha:0:10}, native tree ${native_tree:0:10}"

  if ! bun scripts/ios-app-store.mjs status --require-live \
      --version "$version" --build "$build" --native-tree "$native_tree" \
      >"$RUNNER_TEMP/status-${number}.log" 2>&1; then
    echo "  not live yet:"
    sed 's/^/    /' "$RUNNER_TEMP/status-${number}.log"
    continue
  fi
  echo "  live on the App Store"

  run=$(gh run list --workflow ios-native-check.yml --commit "$sha" \
    --json databaseId,status,conclusion,attempt,url --limit 1 --jq '.[0] // empty')
  if [[ -z "$run" ]]; then
    echo "  no iOS Native Check run for this commit; skipping"
    continue
  fi
  run_id=$(jq -r '.databaseId' <<<"$run")
  status=$(jq -r '.status' <<<"$run")
  conclusion=$(jq -r '.conclusion' <<<"$run")
  attempt=$(jq -r '.attempt' <<<"$run")
  run_url=$(jq -r '.url' <<<"$run")
  if [[ "$status" != "completed" ]]; then
    echo "  iOS Native Check run ${run_id} is ${status}; skipping"
    continue
  fi
  if [[ "$conclusion" == "success" ]]; then
    echo "  iOS Native Check already passed"
    continue
  fi
  if [[ "$conclusion" != "failure" ]]; then
    echo "  iOS Native Check run ${run_id} concluded ${conclusion}; leaving it alone"
    continue
  fi
  # Attempt 1 is the original run that failed while waiting on Apple. If our
  # re-run also fails something else is wrong (the run's log says what), so
  # stop re-running rather than retrying every half hour forever.
  if (( attempt >= 3 )); then
    echo "  iOS Native Check still failing after ${attempt} attempts; not re-running again — see ${run_url}"
    continue
  fi
  echo "  re-running iOS Native Check run ${run_id} (attempt ${attempt} failed)"
  gh run rerun "$run_id"
  gh pr comment "$number" --body "📱 iOS ${version} (build ${build}) is live on the App Store. Re-ran the **iOS Native Check** ([run](${run_url})); this PR can merge once it passes."
done
