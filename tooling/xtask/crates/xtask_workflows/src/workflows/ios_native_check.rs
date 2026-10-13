//! `iOS Native Check` — merge gate for PRs that change native iOS (Tauri)
//! code. Web bundles ship over the air, but native changes only reach users
//! through the App Store, so a PR whose bundle depends on new native code must
//! not merge before that native build is actually downloadable. The gate:
//!
//! 1. Detects native changes with a path filter over `apps/web/tauri/**`.
//! 2. Verifies the PR bumped the iOS release numbers (`just ios-bump`):
//!    marketing version, build number, and `min-native-build.json`.
//! 3. Asks the App Store Connect API whether exactly that version + build is
//!    live on the App Store, and fails with instructions otherwise — add the
//!    `ios-update` label to run the [`super::ios_app_store_release`] workflow,
//!    wait for Apple's approval, then re-run this check.
//!
//! The App Store Connect key comes from Doppler (`ios-release/prd` via the
//! `IOS_RELEASE_DOPPLER_TOKEN` secret), shared with the release workflow.
//!
//! The `skip-ios-update` label bypasses the gate for tauri changes that don't
//! break the native/web contract (label changes re-trigger the check). The job
//! name must stay stable: branch protection references `iOS Native Check`.

use gh_workflow::{Event, Expression, Job, PullRequest, PullRequestType, Run, Step, Use, Workflow};

use crate::workflows::{runners, steps, vars};

/// The path filter matched native iOS code.
const NATIVE_CHANGED: &str = "steps.filter.outputs.ios_native == 'true'";
/// The PR opted out of the gate via the `skip-ios-update` label.
const SKIP_LABEL: &str = "contains(github.event.pull_request.labels.*.name, 'skip-ios-update')";

/// Build the workflow.
pub fn ios_native_check() -> Workflow {
    Workflow::new("iOS Native Check")
        .on(Event::default().pull_request(
            PullRequest::default()
                .add_branch("main")
                .add_type(PullRequestType::Opened)
                .add_type(PullRequestType::Synchronize)
                .add_type(PullRequestType::Reopened)
                .add_type(PullRequestType::ReadyForReview)
                .add_type(PullRequestType::Labeled)
                .add_type(PullRequestType::Unlabeled),
        ))
        .concurrency(vars::concurrency("ios-native-check"))
        .add_job("ios-native-check", check_job())
}

fn check_job() -> Job {
    Job::default()
        .name("iOS Native Check")
        .runs_on(runners::Runner::TinyNoCache.to_string())
        // Full history so the bump check can diff against the base branch.
        .add_step(steps::checkout(true, false))
        .add_step(paths_filter())
        .add_step(setup_bun())
        .add_step(verify_bump())
        .add_step(fetch_credentials())
        .add_step(require_live_version())
        .add_step(skip_notice())
}

fn gated() -> Expression {
    Expression::new(format!("{NATIVE_CHANGED} && !{SKIP_LABEL}"))
}

fn paths_filter() -> Step<Use> {
    Step::new("Detect native iOS changes")
        .uses(
            "dorny",
            "paths-filter",
            "d1c1ffe0248fe513906c8e24db8ea791d46f8590",
        ) // v3.0.3
        .id("filter")
        .add_with((
            "filters",
            indoc::indoc! {"
                ios_native:
                  - 'apps/web/tauri/**'
            "},
        ))
}

fn setup_bun() -> Step<Use> {
    Step::new("Setup Bun")
        .uses(
            "oven-sh",
            "setup-bun",
            "0c5077e51419868618aeaa5fe8019c62421857d6",
        ) // v2.2.0
        .if_condition(gated())
        .add_with(("bun-version", "1.3.13"))
}

fn verify_bump() -> Step<Run> {
    Step::new("Verify iOS release numbers were bumped")
        .run("bun scripts/ios-verify-native-bump.mjs")
        .if_condition(gated())
        .working_directory(xtask_paths::repo_dir!("apps/web"))
        .add_env(("BASE_REF", "origin/${{ github.base_ref }}"))
}

/// Exports `APPLE_API_KEY` / `APPLE_API_ISSUER` via `GITHUB_ENV` and writes
/// the `.p8` where `ios-app-store.mjs` looks for it by default.
fn fetch_credentials() -> Step<Run> {
    Step::new("Fetch App Store Connect credentials from Doppler")
        .run(include_str!("scripts/ios_app_store_connect_credentials.sh"))
        .shell("bash")
        .if_condition(gated())
        .add_env(("DOPPLER_TOKEN", vars::IOS_RELEASE_DOPPLER_TOKEN))
}

fn require_live_version() -> Step<Run> {
    Step::new("Require the App Store release to be live")
        .run("bun scripts/ios-app-store.mjs status --require-live")
        .if_condition(gated())
        .working_directory(xtask_paths::repo_dir!("apps/web"))
}

fn skip_notice() -> Step<Run> {
    Step::new("Skipped via label")
        .run(
            "echo \"Native iOS changes detected, but the skip-ios-update label says they \
             don't break the native/web contract — skipping the App Store release gate.\"",
        )
        .if_condition(Expression::new(format!("{NATIVE_CHANGED} && {SKIP_LABEL}")))
}
