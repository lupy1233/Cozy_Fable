import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Gate de release: un SHA se deployeaza doar daca CI a trecut pe EXACT acel commit
// (push pe main/tag release/* sau workflow_dispatch; o rulare pull_request nu ajunge).

const FULL_SHA = /^[0-9a-f]{40}$/i;
const ALLOWED_EVENTS = new Set(['push', 'workflow_dispatch']);

export function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? '<end>'}`);
    }
    values[key.slice(2)] = value;
  }
  return values;
}

export function parseRepoFromRemote(remoteUrl) {
  const trimmed = String(remoteUrl ?? '').trim();
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(trimmed);
  if (!match) throw new Error(`Cannot derive owner/name from remote ${trimmed || '<empty>'}`);
  return `${match[1]}/${match[2]}`;
}

function matchesWorkflow(runPath, workflowFile) {
  return runPath === workflowFile || (typeof runPath === 'string' && runPath.startsWith(`${workflowFile}@`));
}

export async function requireGreenCi({
  repo,
  sha: rawSha,
  workflowFile = '.github/workflows/ci.yml',
  token,
  fetchImpl = fetch,
}) {
  if (!FULL_SHA.test(String(rawSha ?? ''))) {
    throw new Error(`Expected a full 40-character SHA, received ${rawSha ?? 'missing'}`);
  }
  const sha = rawSha.toLowerCase();
  if (!/^[^/\s]+\/[^/\s]+$/.test(String(repo ?? ''))) {
    throw new Error(`Expected repo as owner/name, received ${repo ?? 'missing'}`);
  }
  if (!token) throw new Error('Missing GitHub token (GITHUB_TOKEN, GH_TOKEN or `gh auth login`)');

  const url = new URL(`https://api.github.com/repos/${repo}/actions/runs`);
  url.searchParams.set('head_sha', sha);
  url.searchParams.set('per_page', '100');
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status}`);
  const payload = await response.json();
  const runs = (payload?.workflow_runs ?? []).filter(
    (run) => matchesWorkflow(run?.path, workflowFile) && run?.head_sha === sha,
  );

  const green = runs.find(
    (run) => ALLOWED_EVENTS.has(run.event) && run.status === 'completed' && run.conclusion === 'success',
  );
  if (green) {
    return {
      sha,
      runId: green.id,
      htmlUrl: green.html_url,
      event: green.event,
      headBranch: green.head_branch,
    };
  }

  if (runs.length === 0) throw new Error(`No ${workflowFile} run found for ${sha}`);
  const eligible = runs.filter((run) => ALLOWED_EVENTS.has(run.event));
  if (eligible.length === 0) {
    const events = [...new Set(runs.map((run) => run.event))].join(', ');
    throw new Error(`Only ${events} runs exist for ${sha}; push the release tag or run workflow_dispatch on it`);
  }
  const pending = eligible.find((run) => run.status !== 'completed');
  if (pending) throw new Error(`CI is still ${pending.status} for ${sha}: ${pending.html_url}`);
  const failed = eligible[0];
  throw new Error(`CI concluded ${failed.conclusion ?? 'unknown'} for ${sha}: ${failed.html_url}`);
}

function resolveToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!args.sha) {
    throw new Error('Usage: node tools/release/require-green-ci.mjs --sha <40-hex> [--repo owner/name] [--workflow .github/workflows/ci.yml]');
  }
  const repo = args.repo ?? parseRepoFromRemote(execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }));
  const result = await requireGreenCi({
    repo,
    sha: args.sha,
    workflowFile: args.workflow ?? '.github/workflows/ci.yml',
    token: resolveToken(),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
