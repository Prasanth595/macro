//! `iOS App Store Release` — add the `ios-update` label to a PR with breaking
//! native (Tauri) changes and this workflow builds the iOS app from the PR
//! head, uploads it to TestFlight, and submits it for App Review — the release
//! the [`super::ios_native_check`] merge gate then waits on.
//!
//! The PR must already contain the version bump (`just ios-bump` in
//! `apps/web`, committed): the workflow verifies it and fails fast otherwise.
//! Bumping from CI would need a push with a PAT — a `GITHUB_TOKEN` push never
//! re-triggers the PR's required checks, wedging the PR — so the bump stays a
//! one-command local step and release retries stay label-driven (remove and
//! re-add `ios-update`).
//!
//! Runs like [`super::ios_preview`]: the Namespace macOS runner, with
//! cargo-tauri, bun, just, wasm-pack and the pinned toolchain (which carries
//! `aarch64-apple-ios`) from the Nix dev shell. `ios-release.sh` does the
//! Nix-vs-Xcode toolchain split itself through `ios-native-env.sh`, so one
//! `nix develop` invocation covers the whole build.
//!
//! Credentials come from Doppler (`ios-release/prd`, read with the
//! `IOS_RELEASE_DOPPLER_TOKEN` service token, like the DMG workflow's
//! `macos-release/prd`): the App Store Connect team API key (App Manager
//! role) and optionally an Apple Distribution certificate; without the
//! certificate xcodebuild uses cloud signing through the API key.

use gh_workflow::{
    Concurrency, Event, Expression, Job, Level, Permissions, PullRequest, PullRequestType, Run,
    Step, Use, Workflow,
};

use crate::workflows::{runners, steps, vars};

/// Build the workflow.
pub fn ios_app_store_release() -> Workflow {
    Workflow::new("iOS App Store Release")
        .on(Event::default()
            .pull_request(PullRequest::default().add_type(PullRequestType::Labeled)))
        .concurrency(Concurrency::new(Expression::new(
            "ios-app-store-release-${{ github.event.pull_request.number }}",
        )))
        .add_job("release", release_job())
}

fn release_job() -> Job {
    Job::default()
        .name("iOS App Store Release")
        // Same-repo PRs only: the release needs the App Store Connect secrets,
        // which fork PRs don't receive anyway.
        .cond(Expression::new(
            "github.event.label.name == 'ios-update' && \
             github.event.pull_request.head.repo.full_name == github.repository",
        ))
        .runs_on(runners::Runner::MacOsArm.to_string())
        // Device build + upload + up to 30 minutes of App Store Connect
        // processing; the simulator preview alone measured ~11 minutes cold.
        .timeout_minutes(90u32)
        .permissions(
            Permissions::default()
                .contents(Level::Read)
                .pull_requests(Level::Write),
        )
        .add_step(checkout_pr_head())
        .add_step(steps::install_nix_macos())
        .add_step(verify_bump())
        .add_step(fetch_credentials())
        .add_step(configure_signing())
        .add_step(build_and_upload())
        .add_step(submit_for_review())
        .add_step(pr_comment())
}

fn checkout_pr_head() -> Step<Use> {
    Step::new("Checkout PR head")
        .uses(
            "actions",
            "checkout",
            "df4cb1c069e1874edd31b4311f1884172cec0e10",
        ) // v6
        .add_with(("ref", "${{ github.event.pull_request.head.sha }}"))
        // Full history so the bump check can diff against the base branch.
        .add_with(("fetch-depth", 0))
        .add_with(("persist-credentials", false))
}

/// Run a command in `apps/web` inside the Nix dev shell.
fn in_dev_shell(name: &str, commands: &str) -> Step<Run> {
    Step::new(name)
        .run(format!(
            "nix develop --command bash -euo pipefail -c '\n{commands}'"
        ))
        .shell("bash")
}

fn verify_bump() -> Step<Run> {
    in_dev_shell(
        "Verify iOS release numbers were bumped",
        "  cd apps/web\n  bun scripts/ios-verify-native-bump.mjs\n",
    )
    .add_env((
        "BASE_REF",
        "origin/${{ github.event.pull_request.base.ref }}",
    ))
}

/// Writes the API key where altool/tauri/the scripts look for it and exports
/// `APPLE_API_KEY` / `APPLE_API_ISSUER` (plus the optional distribution
/// certificate path) through `GITHUB_ENV` for the steps below.
fn fetch_credentials() -> Step<Run> {
    Step::new("Fetch App Store Connect credentials from Doppler")
        .run(include_str!("scripts/ios_app_store_connect_credentials.sh"))
        .shell("bash")
        .add_env(("DOPPLER_TOKEN", vars::IOS_RELEASE_DOPPLER_TOKEN))
        .add_env(("IOS_DISTRIBUTION_CERTIFICATE", "1"))
}

fn configure_signing() -> Step<Run> {
    Step::new("Configure signing identity")
        .run(include_str!("scripts/ios_release_signing.sh"))
        .shell("bash")
}

/// Build, validate, upload, and wait for App Store Connect processing +
/// export compliance — the PR already carries the bump, hence `--no-bump`.
/// The PostHog key is what `ios-build.sh` would otherwise pull from Doppler.
fn build_and_upload() -> Step<Run> {
    in_dev_shell(
        "Build and upload to App Store Connect",
        "  bun install --frozen-lockfile\n  cd apps/web\n  just ios-release --no-bump\n",
    )
    .add_env(("VITE_POSTHOG_API_KEY", vars::POSTHOG_API_KEY))
}

fn submit_for_review() -> Step<Run> {
    in_dev_shell(
        "Submit for App Review",
        "  cd apps/web\n  bun scripts/ios-app-store.mjs submit\n",
    )
}

fn pr_comment() -> Step<Use> {
    Step::new("Comment on the PR")
        .uses(
            "actions",
            "github-script",
            "f28e40c7f34bde8b3046d885e986cb6290c5673b",
        )
        .if_condition(Expression::new("always()"))
        .add_with(("github-token", "${{ secrets.GITHUB_TOKEN }}"))
        .add_with((
            "script",
            indoc::indoc! {r#"
                const fs = require('fs');
                const conf = JSON.parse(
                  fs.readFileSync('apps/web/tauri/src-tauri/tauri.ios.conf.json', 'utf8')
                );
                const version = conf.version;
                const build = conf.bundle.iOS.bundleVersion;
                const runUrl =
                  `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}` +
                  `/actions/runs/${context.runId}`;
                const success = '${{ job.status }}' === 'success';
                const body = success
                  ? [
                      `📱 iOS ${version} (build ${build}) was uploaded to TestFlight and submitted for App Review.`,
                      '',
                      'When Apple approves it, the version releases to the App Store automatically;',
                      're-run the **iOS Native Check** on this PR then to unblock merging.',
                      `After merge, the next prod deploy raises the iOS native build floor (\`MIN_NATIVE_BUILD_IOS\`) to ${build}, prompting older installs to update.`,
                      '',
                      `[Workflow run](${runUrl})`,
                    ].join('\n')
                  : [
                      `📱 iOS App Store release for ${version} (build ${build}) **failed** — see the [workflow run](${runUrl}).`,
                      '',
                      'Fix the problem, then remove and re-add the `ios-update` label to retry.',
                    ].join('\n');
                await github.rest.issues.createComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: context.issue.number,
                  body,
                });
            "#},
        ))
}
