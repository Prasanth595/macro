// Google Play as the source of truth for "is this Android build live": the
// counterpart of `ios-app-store.mjs status` for the App Store.
//
//   bun scripts/android-play-status.mjs --version-code N [--require-live]
//       [--native-hash H] [--pr N]
//
// Reads the production (and internal) track through a throwaway edit and
// reports where version code N is. With --require-live it exits non-zero
// unless N is a completed production release whose release notes carry the
// provenance stamp written by the release workflow ("native tree <hash> for
// PR #<n>") matching --native-hash / --pr when given — the same check the
// iOS gate makes against the TestFlight "What to Test" text. Needs
// GOOGLE_PLAY_ACCESS_TOKEN (androidpublisher scope).
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const packageName = 'com.macro.workspace.mobile';
const api = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits`;
export const consoleUrl =
  'https://play.google.com/console/developers/app/com.macro.workspace.mobile/tracks/production';

export const STAMP_RE = /native tree ([0-9a-f]{40})/;
export const STAMP_PR_RE = /for PR #(\d+)/;

/// The provenance text the release workflow puts in the Play release notes.
export function stamp(nativeHash, pr) {
  return `native tree ${nativeHash} for PR #${pr}`;
}

function releasesOf(track) {
  const releases = track?.releases;
  return Array.isArray(releases) ? releases : [];
}

/// Where a version code stands, from the two track payloads.
export function versionCodeStatus(production, internal, versionCode) {
  const code = String(versionCode);
  const find = (track) =>
    releasesOf(track).find((release) =>
      (release.versionCodes ?? []).map(String).includes(code)
    );
  const live = find(production);
  const testing = find(internal);
  const notes = (release) =>
    (release?.releaseNotes ?? []).map((note) => note.text ?? '').join('\n');
  const stampOf = (release) => {
    const text = notes(release);
    return {
      tree: text.match(STAMP_RE)?.[1] ?? null,
      pr: text.match(STAMP_PR_RE)?.[1] ?? null,
    };
  };
  return {
    versionCode: code,
    live: live?.status === 'completed',
    productionStatus: live?.status ?? null,
    internalStatus: testing?.status ?? null,
    stamp: live ? stampOf(live) : testing ? stampOf(testing) : null,
  };
}

/// Why a status fails --require-live, or null when it passes.
export function liveProblem(status, { nativeHash, pr } = {}) {
  if (!status.live) {
    return status.productionStatus
      ? `version code ${status.versionCode} is on the production track with status ${status.productionStatus}, not completed (Google review or a staged rollout in progress?)`
      : status.internalStatus
        ? `version code ${status.versionCode} is only on the internal track (status ${status.internalStatus}); it has not been promoted to production`
        : `version code ${status.versionCode} is on neither the production nor the internal track`;
  }
  if (nativeHash && status.stamp?.tree !== nativeHash) {
    return `version code ${status.versionCode} is live, but was built from native tree ${status.stamp?.tree ?? 'unknown (no provenance stamp)'}, not ${nativeHash}: native code changed after that build (pushed to the PR, or landed on main since)`;
  }
  if (pr && status.stamp?.pr !== String(pr)) {
    return `version code ${status.versionCode} is live, but was released for PR #${status.stamp?.pr ?? 'unknown'}, not #${pr}`;
  }
  return null;
}

/// Read both tracks through a throwaway edit (always discarded).
export async function readTracks({ token, request = fetch }) {
  if (!token) throw new Error('Missing Google Play access token');
  async function call(method, path, body = undefined) {
    const response = await request(`${api}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new Error(`Google Play ${method} ${path} failed (HTTP ${response.status})`);
    return response.status === 204 ? undefined : response.json();
  }
  const edit = await call('POST', '', {});
  if (typeof edit?.id !== 'string' || !edit.id)
    throw new Error('Google Play did not return an edit ID');
  const editPath = `/${encodeURIComponent(edit.id)}`;
  try {
    const production = await call('GET', `${editPath}/tracks/production`);
    const internal = await call('GET', `${editPath}/tracks/internal`);
    return { production, internal };
  } finally {
    try {
      await call('DELETE', editPath);
    } catch {
      // A leftover read-only edit expires on its own.
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith('--')) throw new Error(`Unexpected argument ${flag}`);
    const name = flag.slice(2);
    if (name === 'require-live') args[name] = true;
    else args[name] = argv[++i];
  }
  return args;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!/^[1-9][0-9]{0,9}$/.test(args['version-code'] ?? ''))
      throw new Error('--version-code must be a positive integer');
    const { production, internal } = await readTracks({
      token: process.env.GOOGLE_PLAY_ACCESS_TOKEN,
    });
    const status = versionCodeStatus(production, internal, args['version-code']);
    console.log(
      `Version code ${status.versionCode}: production ${status.productionStatus ?? 'absent'}, internal ${status.internalStatus ?? 'absent'}` +
        (status.stamp?.tree ? `, built from native tree ${status.stamp.tree} for PR #${status.stamp.pr ?? '?'}` : '')
    );
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, `live=${status.live}\n`);
    if (args['require-live']) {
      const problem = liveProblem(status, { nativeHash: args['native-hash'], pr: args.pr });
      if (problem) {
        console.error(`Android native changes require version code ${status.versionCode} to be live on Google Play before merging, but ${problem}.
  - Not started yet? Add the \`android-update\` label to the PR to build, upload
    and promote it.
  - Promoted? Wait for Google review; the \`Android Release Watch\` workflow
    re-runs this check within half an hour of the release.
  - Native code changed since the release? Bump (\`just android-bump\`), commit,
    re-add \`android-update\`.
  - If the native change doesn't break the native/web contract, add the
    \`skip-android-update\` label instead.
${consoleUrl}`);
        process.exitCode = 1;
      } else {
        console.log(`Version code ${status.versionCode} is live on Google Play production.`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Google Play status check failed');
    process.exitCode = 1;
  }
}
