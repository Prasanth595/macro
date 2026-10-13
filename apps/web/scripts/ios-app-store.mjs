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
// hand-made releases can't make the committed number fall behind. status's
// collision check (on with --require-live or --require-unused-build) fails when
// a build at or above ours exists under a different marketing version: the
// native build floor assumes numbers increase across every release.

import { readFileSync } from "node:fs";
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

async function api(pathname, { method = "GET", body } = {}) {
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
      highest = { number, version: preReleaseVersions.get(preReleaseId) ?? "unknown" };
    }
    const next = page.links?.next;
    pathname = next ? next.replace(API_BASE, "") : null;
  }
  return highest;
}

/// Fail when a build at or above ours was uploaded under another marketing
/// version — our number would then not be the newest native code, and the
/// floor `min-native-build.json` derives from it would lie.
async function requireUnusedBuild() {
  const highest = await highestUploadedBuild();
  if (!highest) {
    console.log("No builds uploaded yet; build number is free.");
    return;
  }
  if (highest.number >= Number(build) && highest.version !== version) {
    console.error(`Build ${build} is not above the highest build App Store Connect has seen: \
build ${highest.number} was uploaded for version ${highest.version}
(a manual release whose number was never committed?). Re-bump past it and commit:
  cd apps/web && doppler run --project ios-release --config prd -- just ios-bump
${testflightUrl}`);
    exit(1);
  }
  console.log(
    highest.number >= Number(build)
      ? `Build ${build} was already uploaded for this version ${version} (a retry).`
      : `Build ${build} is above the highest uploaded build ` +
          `(${highest.number}, version ${highest.version}).`,
  );
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

  console.log(`Build is ready for TestFlight: ${testflightUrl}`);
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
  - Submitted? Wait for Apple to approve and release it, then re-run this
    check.
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
  console.log(`App Store version ${version} (${build}) is live.`);
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
