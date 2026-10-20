// Shared helpers of the sdd-engineering hook scripts (guards and the check-hook wrapper).
// Self-contained Node ESM, no dependencies, nothing newer than Node 16.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

// Reads the hook payload from stdin. Returns null when it is not a JSON object.
export function readInput() {
  try {
    const parsed = JSON.parse(readFileSync(0, 'utf8'));
    return parsed !== null && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// A plugin option is unset when the env var is missing or empty, or when it still carries the
// `${user_config.KEY}` placeholder (Claude Code does not apply `default` when nothing was saved).
function isUnset(value) {
  return value === undefined || value.trim() === '' || /^\$\{/.test(value.trim());
}

// The value of plugin option `key` (env CLAUDE_PLUGIN_OPTION_<KEY>), or `fallback`.
// The env var name is tried as written and in upper case.
export function option(key, fallback, env = process.env) {
  for (const name of [`CLAUDE_PLUGIN_OPTION_${key}`, `CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`]) {
    if (!isUnset(env[name])) return env[name].trim();
  }
  return fallback;
}

// Resolves symlinks on the deepest existing ancestor, so a link cannot lead a write out of the folder.
export function realPath(target) {
  let existing = target;
  const tail = [];
  while (!existsSync(existing)) {
    tail.unshift(basename(existing));
    const parent = dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  return join(realpathSync(existing), ...tail);
}

export function projectRoot(input) {
  return realpathSync(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
}

// The real path of a project folder given as plugin option (relative to the root, or absolute).
export function configuredDir(root, key, fallback) {
  return realPath(resolve(root, option(key, fallback)));
}

const STATUS_LINES = /^Status:[ \t]*(.*)$/gm;

// Every `Status:` line must say the same thing, so a second line cannot hide another status.
export function hasStatus(text, wanted) {
  const statuses = [...text.matchAll(STATUS_LINES)].map((match) => match[1].trim());
  return statuses.length > 0 && statuses.every((status) => status === wanted);
}

// The file as the Edit tool would leave it; null when the edit cannot apply (the tool will fail).
export function afterEdit(text, args) {
  const from = String(args.old_string ?? '');
  const to = String(args.new_string ?? '');
  if (from === '' || !text.includes(from)) return null;
  return args.replace_all === true ? text.split(from).join(to) : text.replace(from, () => to);
}

export function makeBlock(prefix) {
  return (reason) => {
    process.stderr.write(`${prefix}: ${reason}\n`);
    process.exit(2);
  };
}
