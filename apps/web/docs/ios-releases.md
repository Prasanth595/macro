# iOS releases and breaking Tauri changes

Web bundles ship to installed apps over the air (see
`tauri/macro_bundle_updater_plugin`), but native code — anything under
`apps/web/tauri/` — only reaches users through the App Store. A bundle that
depends on new native code must therefore never be deployed before the
matching native build is downloadable, and users on older native builds must
be pushed to update before they receive that bundle.

Two generated workflows plus a checked-in `min-native-build.json` enforce
this end to end.

## The flow for a PR with breaking native changes

1. **`iOS Native Check`** (`.github/workflows/ios-native-check.yml`) runs on
   every PR against `main`. If the PR touches `apps/web/tauri/**` it requires:
   - the iOS release numbers to be bumped relative to `main`, and
   - that exact version + build to be **live on the App Store**.

   Until both hold, the check fails and the PR cannot merge.
2. You bump the numbers locally and commit the result:

   ```bash
   cd apps/web && just ios-bump
   ```

   This bumps the marketing version (`2.0.9` → `2.0.10`) and build number in
   `tauri/src-tauri/tauri.ios.conf.json`, raises the `ios` floor in
   `min-native-build.json` to the new build number, and syncs the generated
   Apple project metadata.
3. Add the **`ios-update`** label to the PR. The
   **`iOS App Store Release`** workflow
   (`.github/workflows/ios-app-store-release.yml`) then builds the app from
   the PR head on the Namespace macOS runner inside the Nix dev shell (like
   the `ios-preview` label), uploads it to TestFlight, waits for App Store
   Connect processing + export compliance, and submits it for App Review
   (release type: automatic after approval). It comments the outcome
   on the PR. To retry after a failure, remove and re-add the label.
4. Wait for Apple to approve. The version releases automatically; re-run the
   failed `iOS Native Check` on the PR and it turns green. Merge.
5. The next prod web deploy (`just build-prod`) reads both platform floors
   from `min-native-build.json` into `MIN_NATIVE_BUILD_ANDROID` /
   `MIN_NATIVE_BUILD_IOS`, so `dist/bundle-manifest.json` carries
   `minNativeBuilds.ios` = the new build number. Installed apps on older
   native builds stop applying OTA bundles and show the "update from the
   App Store" prompt instead (`NativeUpdateRequired` in
   `src/lib/tauri/TauriProvider.tsx`). The Android floor is independent; see
   `docs/ANDROID_DEVELOPMENT.md`.

The bump is deliberately a local command rather than something the label
workflow pushes: a `GITHUB_TOKEN` push never re-triggers required checks, so
a CI-pushed bump commit would wedge the PR.

### Non-breaking tauri changes

If the tauri change doesn't break the native/web contract (comments, dev-only
tooling, desktop-only config), add the **`skip-ios-update`** label instead;
the gate passes without a release. For a non-breaking change you still want
to ship to the App Store, `just ios-bump --no-min` bumps the versions without
raising the floor.

## Manual / TestFlight-only releases

`just ios-release` still does a full local build + TestFlight upload without
any Xcode UI (it bumps only the build number; commit the result). It uses the
same toolchain split as `just ios-build` (`scripts/ios-native-env.sh`), so run
it from the Nix dev shell like any other iOS build. See the header of
`scripts/ios-release.sh` for one-time API-key setup, and
`scripts/ios-app-store.mjs` for the underlying App Store Connect commands
(`wait-build`, `submit`, `status`).

## One-time repository setup

- **Labels**: create `ios-update` and `skip-ios-update`.
- **Branch protection**: add `iOS Native Check` to the required status checks
  for `main`.
- **Secrets** (App Store Connect team API key with the App Manager role, from
  Users and Access → Integrations):
  - `APPLE_API_KEY` — the Key ID
  - `APPLE_API_ISSUER` — the Issuer ID
  - `APPLE_API_KEY_P8` — the contents of the downloaded `AuthKey_<ID>.p8`
  - `POSTHOG_API_KEY` (already present) — embedded as `VITE_POSTHOG_API_KEY`
    in the release build
  - optional `APPLE_DISTRIBUTION_CERTIFICATE_BASE64` /
    `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD` — a base64-encoded Apple
    Distribution `.p12`; without it the release workflow relies on Xcode
    cloud signing through the API key.
