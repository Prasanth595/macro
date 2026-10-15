//! `Android Native Check` — merge gate for PRs that change Android native
//! code, as a job of the web app PR checks so that `Web App Status Check`
//! (the required status check) covers it. The twin of
//! [`super::ios_native_check`]. The gate:
//!
//! 1. Requires an Android `versionCode` bump against the base branch when
//!    the Android native code changed (`scripts/android-version-check.mjs`,
//!    which shares its definition of "native code" with the release
//!    workflow through `android-native.mjs`: every tracked file under
//!    `apps/web/tauri` minus iOS/desktop-only paths, plus the client cache
//!    wasm version). This part always runs.
//! 2. When it changed, asks Google Play whether that version code is a
//!    completed production release built from the native code of the PR's
//!    current merge result (the provenance stamp in the release notes),
//!    and fails with instructions otherwise — add the `android-update` label
//!    to run [`super::super::android_play_release`];
//!    [`super::super::android_release_watch`] re-runs this job once the
//!    release is live.
//!
//! Play access is keyless (Workload Identity Federation), so the job needs
//! `id-token: write`; fork PRs don't get that and fail closed at the auth
//! step. The `skip-android-update` label bypasses the live check for native
//! changes that don't break the native/web contract; labels are read at run
//! time (a re-run keeps the original event payload). The job name must stay
//! stable: the release preconditions, the watcher and the label workflow
//! find it by name.

use gh_workflow::{Expression, Job, Level, Permissions, Run, Step, Use};

use crate::workflows::runners;

/// The job's id in the web app check workflow.
pub(super) const JOB_ID: &str = "android-native-check";

const NATIVE_CHANGED: &str = "steps.android-version.outputs.changed == 'true'";
const NOT_SKIPPED: &str = "steps.labels.outputs.skip != 'true'";
const SKIP_LABEL: &str = "steps.labels.outputs.skip == 'true'";

pub(super) fn job() -> Job {
    Job::default()
        .name("Android Native Check")
        .runs_on(runners::Runner::TinyNoCache.to_string())
        .permissions(
            Permissions::default()
                .contents(Level::Read)
                .id_token(Level::Write)
                .pull_requests(Level::Read),
        )
        .add_step(super::checkout("Checkout PR merge commit", false))
        .add_step(setup_bun())
        .add_step(version_check())
        .add_step(read_labels())
        .add_step(play_auth())
        .add_step(require_live())
        .add_step(skip_notice())
}

fn gated() -> Expression {
    Expression::new(format!("{NATIVE_CHANGED} && {NOT_SKIPPED}"))
}

fn setup_bun() -> Step<Use> {
    Step::new("Setup Bun")
        .uses(
            "oven-sh",
            "setup-bun",
            "0c5077e51419868618aeaa5fe8019c62421857d6",
        ) // v2.2.0
        .add_with(("bun-version", "1.3.13"))
}

/// Always runs: the version code must exceed the base whenever the Android
/// native code changed. Outputs `changed` and `version_code`.
fn version_check() -> Step<Run> {
    Step::new("Require an Android version bump for native changes")
        .run(indoc::indoc! {r#"
            set -euo pipefail
            git fetch -q --depth=1 origin "$BASE_SHA"
            bun scripts/android-version-check.mjs "$BASE_SHA"
        "#})
        .id("android-version")
        .shell("bash")
        .working_directory(xtask_paths::repo_dir!("apps/web"))
        .add_env(("BASE_SHA", "${{ github.event.pull_request.base.sha }}"))
}

fn read_labels() -> Step<Run> {
    Step::new("Read the PR's current labels")
        .run(indoc::indoc! {r#"
            set -euo pipefail
            labels=$(gh pr view "$PR_NUMBER" --repo "$GH_REPO" --json labels --jq '[.labels[].name] | join(",")')
            echo "labels: ${labels:-<none>}"
            if [[ ",${labels}," == *",skip-android-update,"* ]]; then
              echo "skip=true" >> "$GITHUB_OUTPUT"
            else
              echo "skip=false" >> "$GITHUB_OUTPUT"
            fi
        "#})
        .id("labels")
        .if_condition(Expression::new(NATIVE_CHANGED))
        .shell("bash")
        .add_env(("GH_TOKEN", "${{ github.token }}"))
        .add_env(("GH_REPO", "${{ github.repository }}"))
        .add_env(("PR_NUMBER", "${{ github.event.pull_request.number }}"))
}

fn play_auth() -> Step<Use> {
    Step::new("Authenticate to Google Play")
        .uses(
            "google-github-actions",
            "auth",
            "7c6bc770dae815cd3e89ee6cdf493a5fab2cc093",
        ) // v3
        .id("auth")
        .if_condition(gated())
        .add_with((
            "workload_identity_provider",
            "${{ vars.GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER }}",
        ))
        .add_with(("service_account", "${{ vars.GOOGLE_PLAY_SERVICE_ACCOUNT }}"))
        .add_with(("token_format", "access_token"))
        .add_with((
            "access_token_scopes",
            "https://www.googleapis.com/auth/androidpublisher",
        ))
        .add_with(("create_credentials_file", false))
        .add_with(("export_environment_variables", false))
}

/// The gate proper: the committed version code must be live on production,
/// built from the Android native code of the PR's *current* merge result
/// (fetched through the API: a re-run checks out the merge commit of the
/// run's original event, which may predate native code landing on main).
fn require_live() -> Step<Run> {
    Step::new("Require the Play release to be live")
        .run(concat!(
            include_str!("../scripts/android_git_fetch.sh"),
            r#"set -euo pipefail
# GitHub computes the merge commit lazily (mergeable=UNKNOWN until it has),
# so poll for it a little; a PR that really conflicts with main cannot merge.
deadline=$(( $(date +%s) + 120 ))
while true; do
  pr_json=$(gh pr view "$PR_NUMBER" --repo "$GH_REPO" --json mergeable,potentialMergeCommit)
  mergeable=$(jq -r '.mergeable' <<<"$pr_json")
  merge=$(jq -r '.potentialMergeCommit.oid // empty' <<<"$pr_json")
  [[ -n "$merge" ]] && break
  if [[ "$mergeable" == "CONFLICTING" ]]; then
    echo "::error::PR #${PR_NUMBER} conflicts with its base branch, so there is no merge result to check; resolve the conflicts first." >&2
    exit 1
  fi
  if (( $(date +%s) > deadline )); then
    echo "::error::GitHub has not computed PR #${PR_NUMBER}'s merge commit yet (mergeable=${mergeable}); re-run this job in a minute." >&2
    exit 1
  fi
  echo "Merge commit not computed yet (mergeable=${mergeable}); waiting."
  sleep 10
done
gh_fetch "$merge"
native_hash=$(bun scripts/android-native.mjs hash "$merge")
echo "Merge result ${merge:0:10}: Android native hash ${native_hash}"
bun scripts/android-play-status.mjs --version-code "$VERSION_CODE" --require-live \
  --native-hash "$native_hash" --pr "$PR_NUMBER"
"#
        ))
        .if_condition(gated())
        .shell("bash")
        .working_directory(xtask_paths::repo_dir!("apps/web"))
        .add_env(("GH_TOKEN", "${{ github.token }}"))
        .add_env(("GH_REPO", "${{ github.repository }}"))
        .add_env(("PR_NUMBER", "${{ github.event.pull_request.number }}"))
        .add_env(("VERSION_CODE", "${{ steps.android-version.outputs.version_code }}"))
        .add_env(("GOOGLE_PLAY_ACCESS_TOKEN", "${{ steps.auth.outputs.access_token }}"))
}

fn skip_notice() -> Step<Run> {
    Step::new("Skipped via label")
        .run(
            "echo \"Android native changes detected, but the skip-android-update label says they \
             don't break the native/web contract — skipping the Play release gate.\"",
        )
        .if_condition(Expression::new(format!("{NATIVE_CHANGED} && {SKIP_LABEL}")))
}
