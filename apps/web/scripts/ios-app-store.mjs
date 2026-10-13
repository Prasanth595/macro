// App Store Connect automation for the iOS app — one executable, three
// commands sharing auth, config defaults, and app lookup:
//
//   wait-build   Poll until an uploaded build finishes processing and its
//                export compliance is resolved (i.e. TestFlight-ready).
//                ITSAppUsesNonExemptEncryption=false in src-tauri/Info.ios.plist
//                answers the encryption questionnaire during processing
//                (exempt encryption only); if App Store Connect still
//                reports the question as unanswered (shown as "Missing
//                Compliance" in TestFlight) this fails so the plist regression
//                is caught rather than papered over.
//
//   submit       Attach the processed build to an App Store version (created
//                on demand with releaseType AFTER_APPROVAL), fill in empty
//                "What's New" texts, and submit it for App Review. Safe to
//                re-run: an already-submitted version is a no-op success.
//
//   status       Report the App Store state of a version. With --require-live
//                it exits non-zero unless exactly this version+build is live
//                on the App Store — this is the gate the `iOS Native Check`
//                CI workflow runs on PRs with native iOS changes.
//
// Auth (same values as ios-release.sh):
//   APPLE_API_KEY       App Store Connect API Key ID
//   APPLE_API_ISSUER    Issuer ID
//   APPLE_API_KEY_P8    contents of the AuthKey .p8, or
//   APPLE_API_KEY_PATH  path to AuthKey_<KEYID>.p8 (defaults to
//                       ~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8)
// Doppler's names (ios-release/prd: APPLE_API_KEY_ID, APPLE_API_ISSUER,
// APPLE_API_PRIVATE_KEY) are accepted as fallbacks, so locally
//   doppler run --project ios-release --config prd -- bun scripts/ios-app-store.mjs …
// works as-is. CI fetches the same secrets and writes the .p8 to the default path.
//
// --bundle-id / --version / --build default to the identifier in
// tauri/src-tauri/tauri.conf.json and the version / bundleVersion in
// tauri/src-tauri/tauri.ios.conf.json, so CI can run the commands bare.
//
// Usage:
//   bun scripts/ios-app-store.mjs wait-build [--timeout-minutes 30]
//   bun scripts/ios-app-store.mjs submit [--whats-new "release notes"]
//   bun scripts/ios-app-store.mjs status [--require-live] [--require-unused-build]
//   bun scripts/ios-app-store.mjs latest-build
//
// latest-build prints the highest build number App Store Connect has seen for
// the app (any version, TestFlight included) — ios-bump-version.mjs uses it so
// hand-made releases can't make the committed number fall behind.
//
// Provenance: version + build number alone don't identify a PR's native code
// (two PRs bumped from the same base get the same numbers), so wait-build
// stamps each uploaded build with the hash of the native tree it was built
// from (`git rev-parse HEAD:apps/web/tauri`, or --native-tree) in its
// TestFlight "What to Test" text. status's collision check (on with
// --require-live or --require-unused-build) fails when a build at or above
// ours exists with a different stamp — another PR or a hand release — and
// reports `uploaded=true` (GITHUB_OUTPUT) when it is our own upload, so a
// release retry skips the build. The live check requires the live build's
// stamp to match this checkout's native tree.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";

const API_BASE = "https://api.appstoreconnect.apple.com";
const POLL_INTERVAL_MS = 30_000;

// appVersionState values that mean "users can download this version from the
// App Store". READY_FOR_SALE is the deprecated appStoreState spelling.
const LIVE_STATES = new Set(["READY_FOR_DISTRIBUTION", "READY_FOR_SALE"]);

// States past the point of submission — re-running `submit` on these is a
// no-op, not an error.
const SUBMITTED_STATES = new Set([
  "WAITING_FOR_REVIEW",
  "IN_REVIEW",
  "ACCEPTED",
  "PENDING_APPLE_RELEASE",
  "PENDING_DEVELOPER_RELEASE",
  "PROCESSING_FOR_DISTRIBUTION",
  "PROCESSING_FOR_APP_STORE",
  ...LIVE_STATES,
]);

const BOOLEAN_FLAGS = new Set(["require-live", "require-unused-build"]);

/// The directory whose git tree hash identifies "the native code" — the same
/// definition the iOS Native Check path filter uses.
const NATIVE_TREE_PATH = "apps/web/tauri";
const STAMP_RE = /native tree ([0-9a-f]{40})/;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) {
      console.error(`Malformed arguments near ${JSON.stringify(flag)}`);
      exit(2);
    }
    const name = flag.slice(2);
    if (BOOLEAN_FLAGS.has(name)) {
      args[name] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      console.error(`Flag ${flag} requires a value`);
      exit(2);
    }
    args[name] = value;
    i += 1;
  }
  return args;
}

const [command, ...rest] = process.argv.slice(2);
if (!["wait-build", "submit", "status", "latest-build"].includes(command ?? "")) {
  console.error("Usage: ios-app-store.mjs <wait-build|submit|status|latest-build> [flags]");
  exit(2);
}
const args = parseArgs(rest);

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function readJson(relative) {
  return JSON.parse(readFileSync(path.join(appDir, relative), "utf8"));
}

const bundleId =
  args["bundle-id"] ?? readJson("tauri/src-tauri/tauri.conf.json").identifier;

/// Hash of this checkout's native tree (--native-tree overrides, e.g. when
/// the checkout isn't the commit in question), or null outside a git checkout.
function nativeTreeHash() {
  if (args["native-tree"]) {
    return args["native-tree"];
  }
  try {
    return execFileSync("git", ["rev-parse", `HEAD:${NATIVE_TREE_PATH}`], {
      cwd: appDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function setGitHubOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}
const iosConf = readJson("tauri/src-tauri/tauri.ios.conf.json");
const version = args.version ?? iosConf.version;
const build = args.build ?? iosConf.bundle?.iOS?.bundleVersion;
if (!bundleId || !version || !build) {
  console.error(
    "Could not resolve --bundle-id / --version / --build from flags or tauri config.",
  );
  exit(2);
}

// Unset CI env vars surface as empty strings, so || (not ??) throughout.
const keyId = process.env.APPLE_API_KEY || process.env.APPLE_API_KEY_ID;
const issuerId = process.env.APPLE_API_ISSUER;
if (!keyId || !issuerId) {
  console.error("APPLE_API_KEY (or APPLE_API_KEY_ID) and APPLE_API_ISSUER must be set.");
  exit(2);
}

const pem =
  process.env.APPLE_API_KEY_P8 ||
  process.env.APPLE_API_PRIVATE_KEY ||
  readFileSync(
    process.env.APPLE_API_KEY_PATH ||
      path.join(os.homedir(), ".appstoreconnect", "private_keys", `AuthKey_${keyId}.p8`),
    "utf8",
  );
const privateKey = await importPrivateKey(pem);

async function importPrivateKey(pemText) {
  const base64 = pemText
    .replace(/-----(?:BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

function base64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

// App Store Connect JWTs must be short-lived (max 20 minutes); mint a fresh
// one per request instead of tracking expiry.
async function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = { iss: issuerId, iat: now, exp: now + 600, aud: "appstoreconnect-v1" };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // WebCrypto ECDSA signatures are already in the raw r||s form JOSE requires.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

async function api(pathname, { method = "GET", body, onError } = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${await makeToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`${method} ${pathname} → ${response.status}: ${text}`);
    if (onError) {
      await onError(response.status);
    }
    exit(1);
  }
  return response.status === 204 ? null : response.json();
}

const apps = await api(`/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}`);
const app = apps.data[0];
if (!app) {
  console.error(`No App Store Connect app found for bundle id ${bundleId}.`);
  exit(1);
}
const testflightUrl = `https://appstoreconnect.apple.com/apps/${app.id}/testflight/ios`;
const distributionUrl = `https://appstoreconnect.apple.com/apps/${app.id}/distribution`;

/// The uploaded build record for this version+build, or null if App Store
/// Connect hasn't registered it yet.
async function findBuild() {
  const builds = await api(
    `/v1/builds?filter[app]=${app.id}` +
      `&filter[version]=${encodeURIComponent(build)}` +
      `&filter[preReleaseVersion.version]=${encodeURIComponent(version)}` +
      `&sort=-uploadedDate&limit=1`,
  );
  return builds.data[0] ?? null;
}

/// The highest build number uploaded for the app across all marketing
/// versions, as { number, version }, or null when nothing was ever uploaded.
/// Build numbers are compared numerically; non-integer ones are ignored.
async function highestUploadedBuild() {
  let pathname =
    `/v1/builds?filter[app]=${app.id}&include=preReleaseVersion` +
    "&fields[builds]=version,preReleaseVersion&fields[preReleaseVersions]=version" +
    "&sort=-uploadedDate&limit=200";
  let highest = null;
  while (pathname) {
    const page = await api(pathname);
    const preReleaseVersions = new Map(
      (page.included ?? [])
        .filter((record) => record.type === "preReleaseVersions")
        .map((record) => [record.id, record.attributes.version]),
    );
    for (const record of page.data) {
      if (!/^\d+$/.test(record.attributes.version)) continue;
      const number = Number(record.attributes.version);
      if (highest && number <= highest.number) continue;
      const preReleaseId = record.relationships?.preReleaseVersion?.data?.id;
      highest = {
        id: record.id,
        number,
        version: preReleaseVersions.get(preReleaseId) ?? "unknown",
      };
    }
    const next = page.links?.next;
    pathname = next ? next.replace(API_BASE, "") : null;
  }
  return highest;
}

/// The native tree hash stamped on an uploaded build (its TestFlight "What to
/// Test" text), or null for builds uploaded outside the release flow.
async function buildStamp(buildId) {
  const localizations = await api(`/v1/builds/${buildId}/betaBuildLocalizations?limit=10`);
  for (const localization of localizations.data) {
    const match = STAMP_RE.exec(localization.attributes.whatsNew ?? "");
    if (match) {
      return match[1];
    }
  }
  return null;
}

/// Record which native tree a processed build was built from, in its en-US
/// TestFlight "What to Test" text (readable back through the API).
async function stampBuild(buildRecord) {
  const tree = nativeTreeHash();
  if (!tree) {
    console.warn(
      "WARNING: not in a git checkout and no --native-tree given; the build is not " +
        "stamped with its native tree, so the merge gate will not accept it.",
    );
    return;
  }
  const pr = process.env.IOS_RELEASE_PR ? ` for PR #${process.env.IOS_RELEASE_PR}` : "";
  const whatsNew = `Built by ios-release.sh${pr} from native tree ${tree}.`;
  const localizations = await api(
    `/v1/builds/${buildRecord.id}/betaBuildLocalizations?limit=10`,
  );
  const existing = localizations.data.find(
    (localization) => localization.attributes.locale === "en-US",
  );
  if (existing) {
    await api(`/v1/betaBuildLocalizations/${existing.id}`, {
      method: "PATCH",
      body: {
        data: { type: "betaBuildLocalizations", id: existing.id, attributes: { whatsNew } },
      },
    });
  } else {
    await api("/v1/betaBuildLocalizations", {
      method: "POST",
      body: {
        data: {
          type: "betaBuildLocalizations",
          attributes: { locale: "en-US", whatsNew },
          relationships: { build: { data: { type: "builds", id: buildRecord.id } } },
        },
      },
    });
  }
  console.log(`Stamped build ${build} with native tree ${tree}.`);
}

/// Fail when a build at or above ours exists that is not our own upload: the
/// floor `min-native-build.json` derives from our number assumes it is the
/// newest native code, and the gate must never accept another PR's build
/// that happens to share our version + number. Our own earlier upload (same
/// version, same stamp) is a retry: report uploaded=true so the release
/// workflow skips the build and goes straight to submit.
async function requireUnusedBuild() {
  const highest = await highestUploadedBuild();
  const rebump = `Re-bump past it and commit:
  cd apps/web && doppler run --project ios-release --config prd -- just ios-bump
${testflightUrl}`;
  if (!highest) {
    console.log("No builds uploaded yet; build number is free.");
    setGitHubOutput("uploaded", "false");
    return;
  }
  if (highest.number > Number(build)) {
    console.error(`Build ${build} is below the highest build App Store Connect has seen: \
build ${highest.number} was uploaded for version ${highest.version}
(a manual release whose number was never committed, or another native PR). ${rebump}`);
    exit(1);
  }
  if (highest.number === Number(build)) {
    const stamp = await buildStamp(highest.id);
    const ours = nativeTreeHash();
    if (highest.version === version && ours && stamp === ours) {
      console.log(
        `Build ${build} (${version}) was already uploaded from this native tree — ` +
          "a retry; the build and upload can be skipped.",
      );
      setGitHubOutput("uploaded", "true");
      return;
    }
    console.error(`Build ${build} was already uploaded (for version ${highest.version}) from \
different native code: its stamp is ${stamp ?? "missing (uploaded outside the release flow)"}, \
this checkout's native tree is ${ours ?? "unknown (not a git checkout)"}.
Another native PR or a hand release took this number. ${rebump}`);
    exit(1);
  }
  console.log(
    `Build ${build} is above the highest uploaded build ` +
      `(${highest.number}, version ${highest.version}).`,
  );
  setGitHubOutput("uploaded", "false");
}

/// Print the highest uploaded build number alone on stdout (0 when none), for
/// ios-bump-version.mjs; details go to stderr.
async function latestBuild() {
  const highest = await highestUploadedBuild();
  console.error(
    highest
      ? `Highest uploaded build: ${highest.number} (version ${highest.version}).`
      : "No builds uploaded yet.",
  );
  console.log(String(highest?.number ?? 0));
}

/// The IOS appStoreVersion for this marketing version, or null.
async function findAppStoreVersion() {
  const versions = await api(
    `/v1/apps/${app.id}/appStoreVersions` +
      `?filter[versionString]=${encodeURIComponent(version)}` +
      `&filter[platform]=IOS&limit=1`,
  );
  return versions.data[0] ?? null;
}

function versionState(record) {
  return record.attributes.appVersionState ?? record.attributes.appStoreState;
}

async function waitBuild() {
  const timeoutMinutes = Number(args["timeout-minutes"] ?? 30);
  const deadline = Date.now() + timeoutMinutes * 60_000;
  let buildRecord = null;
  while (true) {
    buildRecord = await findBuild();
    const state = buildRecord?.attributes.processingState;
    if (state && state !== "PROCESSING") {
      break;
    }
    if (Date.now() > deadline) {
      console.error(
        `Timed out after ${timeoutMinutes} minutes waiting for build ${version} (${build}) ` +
          `to finish processing. It usually still completes — check TestFlight later:` +
          `\n${testflightUrl}`,
      );
      exit(1);
    }
    console.log(
      buildRecord
        ? `Build ${version} (${build}) is processing…`
        : `Waiting for build ${version} (${build}) to appear in App Store Connect…`,
    );
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const state = buildRecord.attributes.processingState;
  if (state !== "VALID") {
    console.error(
      `Build ${version} (${build}) finished processing with state ${state}. ` +
        `Check App Store Connect for details:\n${testflightUrl}`,
    );
    exit(1);
  }
  console.log(`Build ${version} (${build}) processed successfully.`);

  const compliance = buildRecord.attributes.usesNonExemptEncryption;
  if (compliance === null || compliance === undefined) {
    console.error(
      "Export compliance is unanswered — ITSAppUsesNonExemptEncryption did not make " +
        'it into the uploaded binary. The build will show as "Missing Compliance" ' +
        `in TestFlight until answered manually in App Store Connect:\n${testflightUrl}`,
    );
    exit(1);
  }
  console.log(`Export compliance resolved (usesNonExemptEncryption=${compliance}).`);

  await stampBuild(buildRecord);
  console.log(`Build is ready for TestFlight: ${testflightUrl}`);
}

/// App Store Connect allows one iOS version in flight (anything that is not
/// live or retired) at a time. Explain which one blocks us instead of
/// surfacing the raw 409 from creating ours.
async function explainVersionInFlight() {
  const RETIRED_STATES = new Set([
    "REPLACED_WITH_NEW_VERSION",
    "REMOVED_FROM_SALE",
    "DEVELOPER_REMOVED_FROM_SALE",
    "NOT_APPLICABLE",
  ]);
  const versions = await api(
    `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=20`,
  );
  const inFlight = versions.data
    .filter((record) => record.attributes.versionString !== version)
    .filter((record) => {
      const state = versionState(record);
      return !LIVE_STATES.has(state) && !RETIRED_STATES.has(state);
    })
    .map((record) => `${record.attributes.versionString} (${versionState(record)})`);
  if (inFlight.length === 0) {
    return;
  }
  console.error(`Could not create App Store version ${version}: App Store Connect allows one iOS
version in flight at a time, and these are: ${inFlight.join(", ")}.
Wait for it to ship (another native PR's release) or remove it from review in App
Store Connect, then remove and re-add the ios-update label — the uploaded build
${build} is reused, only the submission is retried.
${distributionUrl}`);
}

async function submit() {
  const buildRecord = await findBuild();
  if (buildRecord?.attributes.processingState !== "VALID") {
    console.error(
      `Build ${version} (${build}) is not processed yet ` +
        `(state ${buildRecord?.attributes.processingState ?? "missing"}). ` +
        "Run `ios-app-store.mjs wait-build` first.",
    );
    exit(1);
  }

  let versionRecord = await findAppStoreVersion();
  if (versionRecord && SUBMITTED_STATES.has(versionState(versionRecord))) {
    console.log(
      `App Store version ${version} is already submitted ` +
        `(state ${versionState(versionRecord)}); nothing to do.\n${distributionUrl}`,
    );
    return;
  }
  if (!versionRecord) {
    versionRecord = (
      await api("/v1/appStoreVersions", {
        method: "POST",
        onError: explainVersionInFlight,
        body: {
          data: {
            type: "appStoreVersions",
            attributes: {
              platform: "IOS",
              versionString: version,
              // Release to the App Store as soon as Apple approves — the
              // merge gate (`status --require-live`) waits for exactly that.
              releaseType: "AFTER_APPROVAL",
            },
            relationships: {
              app: { data: { type: "apps", id: app.id } },
            },
          },
        },
      })
    ).data;
    console.log(`Created App Store version ${version}.`);
  } else {
    console.log(
      `Reusing App Store version ${version} (state ${versionState(versionRecord)}).`,
    );
  }

  await api(`/v1/appStoreVersions/${versionRecord.id}/relationships/build`, {
    method: "PATCH",
    body: { data: { type: "builds", id: buildRecord.id } },
  });
  console.log(`Attached build ${build} to version ${version}.`);

  // App Review rejects an update without "What's New" text. New versions
  // inherit the previous version's metadata but start with it empty, so fill
  // it in (an explicit --whats-new always overwrites).
  const whatsNew = args["whats-new"];
  const localizations = await api(
    `/v1/appStoreVersions/${versionRecord.id}/appStoreVersionLocalizations?limit=50`,
  );
  for (const localization of localizations.data) {
    if (!whatsNew && localization.attributes.whatsNew) {
      continue;
    }
    await api(`/v1/appStoreVersionLocalizations/${localization.id}`, {
      method: "PATCH",
      body: {
        data: {
          type: "appStoreVersionLocalizations",
          id: localization.id,
          attributes: {
            whatsNew: whatsNew ?? "Bug fixes and performance improvements.",
          },
        },
      },
    });
    console.log(`Set What's New for ${localization.attributes.locale}.`);
  }

  const openSubmissions = await api(
    `/v1/reviewSubmissions?filter[app]=${app.id}&filter[platform]=IOS` +
      `&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&limit=25`,
  );
  let submission = openSubmissions.data[0] ?? null;
  if (submission && submission.attributes.state !== "READY_FOR_REVIEW") {
    console.error(
      `A review submission is already in progress (state ${submission.attributes.state}) ` +
        `and it does not contain version ${version}. Resolve it in App Store Connect first:` +
        `\n${distributionUrl}`,
    );
    exit(1);
  }
  if (!submission) {
    submission = (
      await api("/v1/reviewSubmissions", {
        method: "POST",
        body: {
          data: {
            type: "reviewSubmissions",
            attributes: { platform: "IOS" },
            relationships: {
              app: { data: { type: "apps", id: app.id } },
            },
          },
        },
      })
    ).data;
  }

  const items = await api(
    `/v1/reviewSubmissions/${submission.id}/items?include=appStoreVersion&limit=50`,
  );
  const hasOurVersion = items.data.some(
    (item) => item.relationships?.appStoreVersion?.data?.id === versionRecord.id,
  );
  if (!hasOurVersion) {
    await api("/v1/reviewSubmissionItems", {
      method: "POST",
      body: {
        data: {
          type: "reviewSubmissionItems",
          relationships: {
            reviewSubmission: {
              data: { type: "reviewSubmissions", id: submission.id },
            },
            appStoreVersion: {
              data: { type: "appStoreVersions", id: versionRecord.id },
            },
          },
        },
      },
    });
  }

  await api(`/v1/reviewSubmissions/${submission.id}`, {
    method: "PATCH",
    body: {
      data: {
        type: "reviewSubmissions",
        id: submission.id,
        attributes: { submitted: true },
      },
    },
  });
  console.log(
    `Submitted ${version} (${build}) for App Review. Track it at:\n${distributionUrl}`,
  );
}

async function status() {
  const requireLive = args["require-live"] === true;
  if (requireLive || args["require-unused-build"] === true) {
    await requireUnusedBuild();
  }
  const versionRecord = await findAppStoreVersion();

  const fail = (reason) => {
    console.error(`${reason}

This PR changes native iOS code, so iOS ${version} (build ${build}) must be
live on the App Store before merging (the next prod deploy will raise the
iOS native build floor to ${build} and prompt older installs to update):
  - Not started yet? Add the \`ios-update\` label to the PR to build, upload,
    and submit it for review.
  - Submitted? Wait for Apple to approve and release it. The \`iOS Release
    Watch\` workflow re-runs this check within half an hour of the release
    (or re-run it yourself).
  - If these tauri changes don't break the native/web contract, add the
    \`skip-ios-update\` label instead.
${distributionUrl}`);
    exit(1);
  };

  if (!versionRecord) {
    console.log(`No App Store version ${version} exists for ${bundleId}.`);
    if (requireLive) {
      fail(`App Store version ${version} has not been created.`);
    }
    return;
  }

  const state = versionState(versionRecord);
  const attachedBuild = await api(`/v1/appStoreVersions/${versionRecord.id}/build`);
  const attachedBuildNumber = attachedBuild.data?.attributes.version ?? null;
  console.log(
    `App Store version ${version}: state ${state}, ` +
      `build ${attachedBuildNumber ?? "not attached"}.`,
  );
  if (!requireLive) {
    return;
  }

  if (!LIVE_STATES.has(state)) {
    fail(`App Store version ${version} is not live yet (state ${state}).`);
  }
  if (attachedBuildNumber !== build) {
    fail(
      `App Store version ${version} is live but was built from build ` +
        `${attachedBuildNumber ?? "unknown"}, not this PR's build ${build}.`,
    );
  }
  const stamp = await buildStamp(attachedBuild.data.id);
  const ours = nativeTreeHash();
  if (!ours || stamp !== ours) {
    console.error(`App Store version ${version} (${build}) is live, but that build was not built from
this PR's current native code: its stamp is ${stamp ?? "missing (uploaded outside the release flow)"},
this PR's native tree (${NATIVE_TREE_PATH}) is ${ours ?? "unknown"}.
Either native commits were pushed after the release, or another PR / a hand
release shipped the same version + build number. Bump again, commit, and
re-add the ios-update label so what this PR actually contains gets released:
  cd apps/web && doppler run --project ios-release --config prd -- just ios-bump
${distributionUrl}`);
    exit(1);
  }
  console.log(`App Store version ${version} (${build}) is live, built from this native tree.`);
}

if (command === "wait-build") {
  await waitBuild();
} else if (command === "submit") {
  await submit();
} else if (command === "latest-build") {
  await latestBuild();
} else {
  await status();
}
