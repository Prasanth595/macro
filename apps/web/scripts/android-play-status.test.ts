import { describe, expect, it, vi } from 'vitest';
import {
  liveProblem,
  readTracks,
  stamp,
  versionCodeStatus,
} from './android-play-status.mjs';

const hash = 'a'.repeat(40);
const live = {
  status: 'completed',
  versionCodes: ['3'],
  releaseNotes: [{ language: 'en-US', text: stamp(hash, 42) }],
};
const production = { track: 'production', releases: [live] };
const internal = {
  track: 'internal',
  releases: [{ status: 'completed', versionCodes: ['4'], releaseNotes: [{ language: 'en-US', text: stamp('b'.repeat(40), 43) }] }],
};

describe('versionCodeStatus', () => {
  it('reads the production release and its provenance stamp', () => {
    expect(versionCodeStatus(production, internal, 3)).toEqual({
      versionCode: '3',
      live: true,
      productionStatus: 'completed',
      internalStatus: null,
      stamp: { tree: hash, pr: '42' },
    });
  });

  it('reports a version that is only in internal testing', () => {
    const status = versionCodeStatus(production, internal, '4');
    expect(status.live).toBe(false);
    expect(status.internalStatus).toBe('completed');
    expect(liveProblem(status)).toMatch(/only on the internal track/);
  });

  it('reports an unknown version', () => {
    expect(liveProblem(versionCodeStatus(production, internal, '9'))).toMatch(/neither/);
    expect(liveProblem(versionCodeStatus({ track: 'production' }, undefined, '9'))).toMatch(/neither/);
  });

  it('treats a non-completed production release as not live', () => {
    const staged = { track: 'production', releases: [{ ...live, status: 'inProgress' }] };
    expect(liveProblem(versionCodeStatus(staged, internal, '3'))).toMatch(/inProgress/);
  });
});

describe('liveProblem', () => {
  const status = versionCodeStatus(production, internal, '3');
  it('passes when the stamp matches', () => {
    expect(liveProblem(status, { nativeHash: hash, pr: 42 })).toBeNull();
    expect(liveProblem(status)).toBeNull();
  });
  it('fails on a different native tree or PR', () => {
    expect(liveProblem(status, { nativeHash: 'c'.repeat(40) })).toMatch(/native code changed/);
    expect(liveProblem(status, { pr: 7 })).toMatch(/released for PR #42, not #7/);
  });
  it('names a missing stamp', () => {
    const unstamped = { track: 'production', releases: [{ status: 'completed', versionCodes: ['3'] }] };
    expect(liveProblem(versionCodeStatus(unstamped, internal, '3'), { nativeHash: hash })).toMatch(/no provenance stamp/);
  });
});

describe('readTracks', () => {
  it('opens an edit, reads both tracks, and discards the edit', async () => {
    const calls: string[] = [];
    const request = vi.fn(async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url.split('/edits')[1]}`);
      const body = url.endsWith('/edits')
        ? { id: 'edit-1' }
        : url.endsWith('/tracks/production')
          ? production
          : url.endsWith('/tracks/internal')
            ? internal
            : undefined;
      return { ok: true, status: body === undefined ? 204 : 200, json: async () => body };
    });
    await expect(readTracks({ token: 't', request })).resolves.toEqual({ production, internal });
    expect(calls).toEqual([
      'POST ',
      'GET /edit-1/tracks/production',
      'GET /edit-1/tracks/internal',
      'DELETE /edit-1',
    ]);
  });

  it('rejects without a token', async () => {
    await expect(readTracks({ token: '' })).rejects.toThrow(/access token/);
  });
});
