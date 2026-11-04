import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArguments, parseRepoFromRemote, requireGreenCi } from './require-green-ci.mjs';

const SHA = 'd64437387c57c4396ce7451834a1c215a52fb9d9';
const WORKFLOW = '.github/workflows/ci.yml';

function run(overrides = {}) {
  return {
    id: 101,
    path: WORKFLOW,
    head_sha: SHA,
    head_branch: 'release/2026-10-01-example',
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    html_url: 'https://github.com/owner/repo/actions/runs/101',
    ...overrides,
  };
}

function fakeFetch(runs, calls = []) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok: true, status: 200, json: async () => ({ total_count: runs.length, workflow_runs: runs }) };
  };
}

const base = { repo: 'owner/repo', token: 'test-token' };

test('parses flag/value arguments and remote URLs', () => {
  assert.deepEqual(parseArguments(['--sha', SHA, '--repo', 'owner/repo']), { sha: SHA, repo: 'owner/repo' });
  assert.throws(() => parseArguments(['--sha']), /Invalid argument/);
  assert.equal(parseRepoFromRemote('https://github.com/lupy1233/Cozy_Fable.git\n'), 'lupy1233/Cozy_Fable');
  assert.equal(parseRepoFromRemote('git@github.com:lupy1233/Cozy_Fable.git'), 'lupy1233/Cozy_Fable');
  assert.throws(() => parseRepoFromRemote('https://gitlab.com/x/y.git'), /Cannot derive/);
});

test('refuses a short SHA before calling GitHub', async () => {
  const calls = [];
  await assert.rejects(
    requireGreenCi({ ...base, sha: 'd644373', fetchImpl: fakeFetch([run()], calls) }),
    /full 40-character SHA/,
  );
  assert.equal(calls.length, 0);
});

test('accepts a successful push run on the exact SHA (release tag)', async () => {
  const calls = [];
  const result = await requireGreenCi({ ...base, sha: SHA, fetchImpl: fakeFetch([run()], calls) });
  assert.deepEqual(result, {
    sha: SHA,
    runId: 101,
    htmlUrl: 'https://github.com/owner/repo/actions/runs/101',
    event: 'push',
    headBranch: 'release/2026-10-01-example',
  });
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/repos/owner/repo/actions/runs');
  assert.equal(url.searchParams.get('head_sha'), SHA);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[0].init.headers['X-GitHub-Api-Version'], '2022-11-28');
});

test('accepts workflow_dispatch and a path with @ref suffix', async () => {
  const result = await requireGreenCi({
    ...base,
    sha: SHA,
    fetchImpl: fakeFetch([run({ event: 'workflow_dispatch', path: `${WORKFLOW}@refs/tags/release/x` })]),
  });
  assert.equal(result.event, 'workflow_dispatch');
});

test('refuses when only a pull_request run succeeded', async () => {
  await assert.rejects(
    requireGreenCi({ ...base, sha: SHA, fetchImpl: fakeFetch([run({ event: 'pull_request' })]) }),
    /Only pull_request runs exist/,
  );
});

test('refuses a failed run and reports its URL', async () => {
  await assert.rejects(
    requireGreenCi({ ...base, sha: SHA, fetchImpl: fakeFetch([run({ conclusion: 'failure' })]) }),
    /concluded failure .*actions\/runs\/101/,
  );
});

test('refuses a run that is still in progress', async () => {
  await assert.rejects(
    requireGreenCi({ ...base, sha: SHA, fetchImpl: fakeFetch([run({ status: 'in_progress', conclusion: null })]) }),
    /still in_progress/,
  );
});

test('ignores other workflows and other SHAs', async () => {
  const runs = [
    run({ path: '.github/workflows/other.yml' }),
    run({ head_sha: 'a'.repeat(40) }),
  ];
  await assert.rejects(requireGreenCi({ ...base, sha: SHA, fetchImpl: fakeFetch(runs) }), /No .* run found/);
});

test('refuses when there is no run at all or no token', async () => {
  await assert.rejects(requireGreenCi({ ...base, sha: SHA, fetchImpl: fakeFetch([]) }), /No .* run found/);
  await assert.rejects(requireGreenCi({ ...base, token: '', sha: SHA, fetchImpl: fakeFetch([run()]) }), /Missing GitHub token/);
});

test('surfaces GitHub API errors without leaking the token', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(requireGreenCi({ ...base, sha: SHA, fetchImpl }), (error) => {
    assert.match(error.message, /HTTP 401/);
    assert.ok(!error.message.includes('test-token'));
    return true;
  });
});
