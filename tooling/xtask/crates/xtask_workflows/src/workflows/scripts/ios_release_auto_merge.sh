set -euo pipefail
# Enable GitHub auto-merge on the PR, guarded twice (see ios_app_store_release.rs).
comment() { gh pr comment "$PR_NUMBER" --repo "$GH_REPO" --body "$1"; }

# 1. The merge gate must be a required check, or auto-merge fires right now,
#    before Apple has approved anything.
required=$(gh api "repos/${GH_REPO}/rules/branches/${BASE_REF}" \
  --jq '[.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context]')
if ! jq -e 'index("iOS Native Check")' <<<"$required" >/dev/null; then
  echo "::error::'iOS Native Check' is not a required status check on ${BASE_REF} (required: ${required}); not enabling auto-merge."
  comment "⚠️ Auto-merge was **not** enabled: \`iOS Native Check\` is not a required status check on \`${BASE_REF}\`, so auto-merge would merge this PR before Apple approves the release. Add it to the branch ruleset (see apps/web/docs/ios-releases.md), then merge by hand once the check passes."
  exit 1
fi

# 2. A merge set up with the Actions token does not trigger on-push workflows
#    (the dev redeploy and the other push-to-main workflows would not run),
#    so a real user/app token is required.
if [[ -z "${AUTO_MERGE_TOKEN:-}" ]]; then
  echo "IOS_RELEASE_GITHUB_TOKEN is not configured; asking the author to enable auto-merge."
  comment "ℹ️ Enable **auto-merge** on this PR yourself (the button next to \"Merge\"): it was not enabled automatically because the \`IOS_RELEASE_GITHUB_TOKEN\` secret is not configured, and auto-merge set up by the Actions token would merge without triggering the push-to-\`${BASE_REF}\` workflows (the dev redeploy among them). GitHub then merges as soon as \`iOS Native Check\` passes."
  exit 0
fi

GH_TOKEN="$AUTO_MERGE_TOKEN" gh pr merge "$PR_NUMBER" --repo "$GH_REPO" --auto --squash
echo "Auto-merge enabled: GitHub merges PR #${PR_NUMBER} once every required check passes."
