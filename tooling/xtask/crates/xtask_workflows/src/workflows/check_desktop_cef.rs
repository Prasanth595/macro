//! Build the macOS Chromium app on every pull request.

use gh_workflow::{Event, Job, Level, Permissions, PullRequest, Step, Workflow};

use crate::workflows::{build_dmg_on_tag, runners, steps};

pub fn check_desktop_cef() -> Workflow {
    Workflow::new("Check macOS Chromium desktop")
        .permissions(Permissions {
            contents: Some(Level::Read),
            ..Default::default()
        })
        .on(Event::default().pull_request(PullRequest::default().add_branch("main")))
        .add_job("build-cef-app", build_cef_app_job())
}

fn build_cef_app_job() -> Job {
    Job::default()
        .name("Build macOS Chromium app")
        .runs_on(vec![
            format!("{}-with-cache", runners::Runner::MacOsArmLarge),
            "nscloud-cache-tag-macro-desktop-macos".to_owned(),
            "nscloud-cache-size-100gb".to_owned(),
        ])
        .add_env(("DESKTOP_NIX_CACHE_SIZE_GB", "100"))
        .add_step(steps::checkout(false, false))
        .add_step(build_dmg_on_tag::assert_arm64())
        .add_step(steps::mount_macos_nix_cache_volume())
        .add_step(steps::install_nix_macos())
        .add_step(build_dmg_on_tag::configure_nix_cache())
        .add_step(
            Step::new("Build Chromium app with Nix")
                .run(include_str!("scripts/check_desktop_cef.sh"))
                .shell("bash"),
        )
        .add_step(build_dmg_on_tag::save_nix_cache())
}
