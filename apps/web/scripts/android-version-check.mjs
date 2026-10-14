import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkAndroidVersion({
  base,
  head = 'HEAD',
  cwd = process.cwd(),
}) {
  if (!base) throw new Error('Provide the PR base commit');
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const baseCommit = git(
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${base}^{commit}`
  );
  const headCommit = git(
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${head}^{commit}`
  );
  const tauriPath = 'apps/web/tauri';
  if (
    git('rev-parse', '--verify', `${baseCommit}:${tauriPath}`) ===
    git('rev-parse', '--verify', `${headCommit}:${tauriPath}`)
  )
    return 'No Tauri changes; no Android version bump needed.';

  const versionCode = (commit) => {
    const config = JSON.parse(
      git('show', `${commit}:${tauriPath}/src-tauri/tauri.android.conf.json`)
    );
    const code = config.bundle?.android?.versionCode;
    if (!Number.isInteger(code) || code < 1 || code > 2_100_000_000)
      throw new Error(`Invalid Android versionCode at ${commit}`);
    return code;
  };
  const previous = versionCode(baseCommit);
  const next = versionCode(headCommit);
  if (next <= previous)
    throw new Error(
      `Tauri changed, but Android versionCode (${next}) must exceed the base branch (${previous}). Run just android-bump in apps/web and commit the result before merging.`
    );
  return `Android versionCode increased from ${previous} to ${next}.`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(checkAndroidVersion({ base: process.argv[2] }));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Android version check failed'
    );
    process.exitCode = 1;
  }
}
