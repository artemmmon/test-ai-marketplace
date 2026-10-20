// Read-only git access for the generator: release tags, HEAD and the origin slug.
// Every function returns null on failure, so the generator also works outside a git checkout.
import { execFileSync } from 'node:child_process';

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/**
 * Tags as `{ name, date, commit }` (date = YYYY-MM-DD of the tag, commit = the commit it points to).
 * Annotated tags use the tagger date and the peeled commit; lightweight tags the commit date.
 */
export function readGitTags(root) {
  const out = git(root, [
    'for-each-ref',
    '--format=%(refname:short)%09%(objectname)%09%(*objectname)%09%(creatordate:iso-strict)',
    'refs/tags',
  ]);
  if (out === null) return null;
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, object, peeled, date] = line.split('\t');
      return { name, commit: peeled || object, date: (date ?? '').slice(0, 10) || null };
    });
}

export function readHeadCommit(root) {
  const out = git(root, ['rev-parse', 'HEAD']);
  const sha = out?.trim();
  return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

/** `owner/repo` from the `origin` remote of a GitHub clone (https or ssh), or null. */
export function readOriginSlug(root) {
  const url = git(root, ['remote', 'get-url', 'origin'])?.trim();
  return url ? parseGithubSlug(url) : null;
}

export function parseGithubSlug(url) {
  const m = /github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(url);
  return m ? `${m[1]}/${m[2]}` : null;
}
