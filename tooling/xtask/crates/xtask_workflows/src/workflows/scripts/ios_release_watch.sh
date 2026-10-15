set -euo pipefail
# For each open PR labeled `ios-update` (PRS: [{number, sha, merge}]), ask App
# Store Connect whether the iOS version + build committed at the PR head is
# live, built from the native tree the PR's merge result would have (`merge`
# is GitHub's test merge commit; the gate checks out the same ref). When it
# is, and the PR's latest `iOS Native Check` job (of the web app PR checks
# run) failed — it fails until the release is live — re-run that job so the
# gate, and the `Web App Status Check` that depends on it, go green without
# anyone clicking "Re-run". GH_TOKEN needs actions:write + pull-requests:write.
cd apps/web
conf_path="apps/web/tauri/src-tauri/tauri.ios.conf.json"

check_pr() {
  local pr=$1 number sha merge conf version build native_tree run run_id status attempt run_url job conclusion job_id
  number=$(jq -r '.number' <<<"$pr")
  sha=$(jq -r '.sha' <<<"$pr")
  merge=$(jq -r '.merge // empty' <<<"$pr")
  if [[ -z "$merge" ]]; then
    echo "PR #${number}: no merge commit (conflicts with main?); skipping"
    return 0
  fi
  conf=$(gh api "repos/${GH_REPO}/contents/${conf_path}?ref=${sha}" --jq '.content' | base64 --decode)
  version=$(jq -r '.version' <<<"$conf")
  build=$(jq -r '.bundle.iOS.bundleVersion' <<<"$conf")
  native_tree_fetch "$merge"
  native_tree=$(native_tree_hash "$merge")
  echo "PR #${number}: iOS ${version} (build ${build}) at ${sha:0:10}, merge-result native tree ${native_tree:0:10}"

  if ! bun scripts/ios-app-store.mjs status --require-live \
      --version "$version" --build "$build" --native-tree "$native_tree" \
      >"$RUNNER_TEMP/status-${number}.log" 2>&1; then
    echo "  not live yet:"
    sed 's/^/    /' "$RUNNER_TEMP/status-${number}.log"
    return 0
  fi
  echo "  live on the App Store"

  run=$(gh run list --workflow web-app-check-main.yml --commit "$sha" \
    --json databaseId,status,attempt,url --limit 1 --jq '.[0] // empty')
  if [[ -z "$run" ]]; then
    echo "  no Web App Pr Checks run for this commit; skipping"
    return 0
  fi
  run_id=$(jq -r '.databaseId' <<<"$run")
  status=$(jq -r '.status' <<<"$run")
  attempt=$(jq -r '.attempt' <<<"$run")
  run_url=$(jq -r '.url' <<<"$run")
  if [[ "$status" != "completed" ]]; then
    echo "  Web App Pr Checks run ${run_id} is ${status}; skipping"
    return 0
  fi
  job=$(gh run view "$run_id" --json jobs \
    --jq '.jobs[] | select(.name == "iOS Native Check") | {id: .databaseId, conclusion}')
  if [[ -z "$job" ]]; then
    echo "  run ${run_id} has no iOS Native Check job; skipping"
    return 0
  fi
  job_id=$(jq -r '.id' <<<"$job")
  conclusion=$(jq -r '.conclusion' <<<"$job")
  if [[ "$conclusion" == "success" ]]; then
    echo "  iOS Native Check already passed"
    return 0
  fi
  if [[ "$conclusion" != "failure" ]]; then
    echo "  iOS Native Check job concluded ${conclusion}; leaving it alone"
    return 0
  fi
  # Attempt 1 is the original run that failed while waiting on Apple. If our
  # re-run also fails something else is wrong (the job's log says what), so
  # stop re-running rather than retrying every half hour forever.
  if (( attempt >= 3 )); then
    echo "  iOS Native Check still failing after ${attempt} attempts; not re-running again — see ${run_url}"
    return 0
  fi
  echo "  re-running iOS Native Check (job ${job_id} of run ${run_id}, attempt ${attempt} failed)"
  gh run rerun --job "$job_id"
  gh pr comment "$number" --body "📱 iOS ${version} (build ${build}) is live on the App Store. Re-ran the **iOS Native Check** ([run](${run_url})); this PR can merge once it passes."
}

# One PR's API hiccup must not stop the others from being checked this
# half hour: each PR runs in its own errexit subshell.
failed=0
while read -r pr; do
  set +e
  ( set -e; check_pr "$pr" )
  rc=$?
  set -e
  if (( rc != 0 )); then
    echo "  error while checking PR $(jq -r '.number' <<<"$pr") (exit ${rc}); continuing"
    failed=1
  fi
done < <(jq -c '.[]' <<<"$PRS")
exit $failed
