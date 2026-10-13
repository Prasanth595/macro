// Bump the iOS release numbers in one place, then sync the generated Apple
// project metadata so everything stays consistent:
//
//   default          App Store release for a breaking native change (the
//                    `ios-update` PR flow): bump the marketing version's
//                    patch component and the build number, and raise the iOS
//                    floor in min-native-build.json to the new build number so
//                    the next prod web deploy (`just build-prod` →
//                    MIN_NATIVE_BUILD_IOS) refuses to run on older native
//                    builds and prompts the App Store update.
//   --no-min         App Store release that does NOT break older native
//                    builds: bump marketing version + build number only.
//   --build-only     TestFlight iteration: bump only the build number
//                    (same marketing version; used by ios-release.sh).
//
// The new build number is one above the larger of the committed number and
// the highest build App Store Connect has ever seen for the app (hand-made
// releases don't always get committed, and the native build floor assumes
// numbers only go up). That lookup needs the App Store Connect credentials:
//   doppler run --project ios-release --config prd -- just ios-bump
// Without them the bump still works but warns that the number is unverified.
//
// Writes: tauri/src-tauri/tauri.ios.conf.json, min-native-build.json, and the
// synced gen/apple plists + project.yml (via sync-ios-bundle-metadata.mjs).
// Commit all of them.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iosConfPath = path.join(appDir, "tauri", "src-tauri", "tauri.ios.conf.json");
const minNativeBuildPath = path.join(appDir, "min-native-build.json");

const flags = new Set(process.argv.slice(2));
for (const flag of flags) {
  if (!["--no-min", "--build-only"].includes(flag)) {
    console.error(`Unknown argument: ${flag}. Usage: ios-bump-version.mjs [--no-min|--build-only]`);
    exit(2);
  }
}
if (flags.has("--no-min") && flags.has("--build-only")) {
  console.error("--no-min and --build-only are mutually exclusive.");
  exit(2);
}
const buildOnly = flags.has("--build-only");
const raiseMinNativeBuild = !buildOnly && !flags.has("--no-min");

const iosConf = JSON.parse(readFileSync(iosConfPath, "utf8"));

/// The highest build number App Store Connect has for the app, or null when
/// no credentials are available (with a warning — a stale committed number
/// would then go unnoticed).
function highestUploadedBuild() {
  const hasCredentials =
    (process.env.APPLE_API_KEY || process.env.APPLE_API_KEY_ID) && process.env.APPLE_API_ISSUER;
  if (!hasCredentials) {
    console.warn(
      "WARNING: no App Store Connect credentials, so the new build number is only " +
        "based on the committed one. If a release was ever made by hand without " +
        "committing its number, this bump may collide. To be safe, run:\n" +
        "  doppler run --project ios-release --config prd -- just ios-bump",
    );
    return null;
  }
  const output = execFileSync(
    "bun",
    [path.join(appDir, "scripts", "ios-app-store.mjs"), "latest-build"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  ).trim();
  if (!/^\d+$/.test(output)) {
    console.error(`Unexpected latest-build output: ${JSON.stringify(output)}`);
    exit(1);
  }
  return Number(output);
}

const currentBuild = iosConf.bundle?.iOS?.bundleVersion;
if (!/^\d+$/.test(currentBuild ?? "")) {
  console.error(
    `bundleVersion ${JSON.stringify(currentBuild)} in ${path.relative(appDir, iosConfPath)} ` +
      "is not a plain integer; fix it manually before bumping.",
  );
  exit(1);
}
const uploadedBuild = highestUploadedBuild();
if (uploadedBuild !== null && uploadedBuild > Number(currentBuild)) {
  console.log(
    `App Store Connect already has build ${uploadedBuild}, above the committed ` +
      `${currentBuild} (a release made by hand?); bumping past it.`,
  );
}
const newBuild = String(Math.max(Number(currentBuild), uploadedBuild ?? 0) + 1);
iosConf.bundle.iOS.bundleVersion = newBuild;

let newVersion = iosConf.version;
if (!buildOnly) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(iosConf.version ?? "");
  if (!match) {
    console.error(
      `version ${JSON.stringify(iosConf.version)} in ${path.relative(appDir, iosConfPath)} ` +
        'is not of the form "major.minor.patch"; fix it manually before bumping.',
    );
    exit(1);
  }
  newVersion = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
  iosConf.version = newVersion;
}

writeFileSync(iosConfPath, `${JSON.stringify(iosConf, null, 2)}\n`);
console.log(
  buildOnly
    ? `Bumped build number: ${currentBuild} → ${newBuild} (version stays ${newVersion}).`
    : `Bumped iOS release: ${newVersion} (${newBuild}).`,
);

if (raiseMinNativeBuild) {
  const floors = JSON.parse(readFileSync(minNativeBuildPath, "utf8"));
  floors.ios = Number(newBuild);
  writeFileSync(minNativeBuildPath, `${JSON.stringify(floors, null, 2)}\n`);
  console.log(
    `Raised the iOS native build floor to ${newBuild} — after this merges and prod ` +
      "deploys, older native builds will be prompted to update from the App Store.",
  );
}

execFileSync("bun", [path.join(appDir, "scripts", "sync-ios-bundle-metadata.mjs")], {
  stdio: "inherit",
});

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${newVersion}\nbuild=${newBuild}\n`,
  );
}
