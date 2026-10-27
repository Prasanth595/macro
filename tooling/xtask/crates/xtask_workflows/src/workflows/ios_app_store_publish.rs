//! `iOS App Store Publish` — releases the committed iOS version on the App
//! Store. [`super::ios_app_store_release`] submits versions with release type
//! "manual", so Apple's approval holds them in Pending Developer Release
//! until this runs. `release-production` calls it next to the web deploy
//! that ships the matching bundle, without making the deploy wait on it.
//!
//! `ios-app-store.mjs publish` releases only the version + build committed at
//! the deployed commit, and only from that held state: a version approved
//! for a PR that has not merged yet stays held, and an already-live version
//! is left alone. Manually dispatchable to retry a failed release.

use std::collections::HashMap;

use gh_workflow::{
    Event, Job, Level, Permissions, Run, Step, Use, Workflow, WorkflowCall, WorkflowCallSecret,
    WorkflowDispatch,
};

use crate::workflows::{runners, steps, vars};

/// Build the workflow.
pub fn ios_app_store_publish() -> Workflow {
    Workflow::new("iOS App Store Publish")
        .on(Event::default()
            .workflow_call(WorkflowCall::default().secrets(HashMap::from([(
                "IOS_RELEASE_DOPPLER_TOKEN".to_string(),
                WorkflowCallSecret {
                    description: "Doppler service token for ios-release/prd".into(),
                    required: true,
                },
            )])))
            .workflow_dispatch(WorkflowDispatch::default()))
        .add_job("publish", publish_job())
}

fn publish_job() -> Job {
    Job::default()
        .name("Release the approved iOS version on the App Store")
        .runs_on(runners::Runner::TinyNoCache.to_string())
        .timeout_minutes(10u32)
        .permissions(Permissions::default().contents(Level::Read))
        .add_step(steps::checkout(false, false))
        .add_step(setup_bun())
        .add_step(fetch_credentials())
        .add_step(publish())
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

fn fetch_credentials() -> Step<Run> {
    Step::new("Fetch App Store Connect credentials from Doppler")
        .run(include_str!("scripts/ios_app_store_connect_credentials.sh"))
        .shell("bash")
        .add_env(("DOPPLER_TOKEN", vars::IOS_RELEASE_DOPPLER_TOKEN))
}

fn publish() -> Step<Run> {
    Step::new("Release the committed version if Apple approved it")
        .run("bun scripts/ios-app-store.mjs publish")
        .working_directory(xtask_paths::repo_dir!("apps/web"))
}
