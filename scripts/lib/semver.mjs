// Minimal semver: parse, compare and range matching for the subset of spec FR-23.
//
// Supported ranges: exact "1.2.3" (or "=1.2.3"), "^1.2.3", "~1.2.3", ">=1.2.3", ">1.2.3", "<=1.2.3",
// "<1.2.3", "*", and a space-separated AND of relational comparators ">=1.0.0 <2.0.0".
// Anything else (||, hyphen ranges, x-ranges, partial versions) throws a RangeError.

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** @returns {{major:number, minor:number, patch:number, prerelease:string[]} | null} */
export function parseVersion(text) {
  const m = VERSION_RE.exec(String(text).trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease: m[4] ? m[4].split('.') : [] };
}

export function isValidVersion(text) {
  return parseVersion(text) !== null;
}

function comparePrerelease(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1; // a release is greater than any of its prereleases
  if (b.length === 0) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const an = /^\d+$/.test(a[i]);
    const bn = /^\d+$/.test(b[i]);
    if (an && bn) {
      const d = Number(a[i]) - Number(b[i]);
      if (d !== 0) return d < 0 ? -1 : 1;
    } else if (an !== bn) {
      return an ? -1 : 1; // numeric identifiers sort before alphanumeric ones
    } else if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1;
    }
  }
  return 0;
}

/** Compares two versions (strings or parsed). Build metadata is ignored. @returns {-1|0|1} */
export function compareVersions(a, b) {
  const x = typeof a === 'string' ? parseVersion(a) : a;
  const y = typeof b === 'string' ? parseVersion(b) : b;
  if (!x || !y) throw new TypeError(`cannot compare "${typeof a === 'string' ? a : '?'}" and "${typeof b === 'string' ? b : '?'}"`);
  for (const k of ['major', 'minor', 'patch']) {
    if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  }
  return comparePrerelease(x.prerelease, y.prerelease);
}

const COMPARATOR_RE = /^(>=|<=|>|<|=)?(\S+)$/;

/**
 * Parses a range into a list of comparators that must all hold (AND).
 * @returns {Array<{op: '>='|'>'|'<='|'<'|'=', version: ReturnType<typeof parseVersion>}>}
 */
export function parseRange(range) {
  const text = String(range ?? '').trim();
  const fail = () => {
    throw new RangeError(`unsupported version range "${range}"`);
  };
  if (text === '') fail();
  if (text === '*') return [];

  const tokens = text.split(/\s+/);
  if (tokens.length === 1) {
    const t = tokens[0];
    if (t.startsWith('^') || t.startsWith('~')) {
      const v = parseVersion(t.slice(1));
      if (!v) fail();
      return [
        { op: '>=', version: v },
        { op: '<', version: t[0] === '^' ? caretCeiling(v) : { major: v.major, minor: v.minor + 1, patch: 0, prerelease: [] } },
      ];
    }
  }
  const out = [];
  for (const token of tokens) {
    const m = COMPARATOR_RE.exec(token);
    if (!m) fail();
    const v = parseVersion(m[2]);
    if (!v) fail();
    out.push({ op: m[1] ?? '=', version: v });
  }
  return out;
}

function caretCeiling(v) {
  if (v.major > 0) return { major: v.major + 1, minor: 0, patch: 0, prerelease: [] };
  if (v.minor > 0) return { major: 0, minor: v.minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: v.patch + 1, prerelease: [] };
}

/** True when `range` parses (see parseRange). */
export function isSupportedRange(range) {
  try {
    parseRange(range);
    return true;
  } catch {
    return false;
  }
}

/** Does `version` satisfy `range`? Throws RangeError for an unsupported range, TypeError for a bad version. */
export function satisfies(version, range) {
  const v = parseVersion(version);
  if (!v) throw new TypeError(`invalid version "${version}"`);
  const comparators = parseRange(range);
  // Like npm: a prerelease only matches when a comparator names a prerelease of the same major.minor.patch.
  if (v.prerelease.length > 0) {
    const allowed = comparators.some(
      (c) =>
        c.version.prerelease.length > 0 &&
        c.version.major === v.major &&
        c.version.minor === v.minor &&
        c.version.patch === v.patch,
    );
    if (!allowed) return false;
  }
  return comparators.every(({ op, version: c }) => {
    const cmp = compareVersions(v, c);
    switch (op) {
      case '>=':
        return cmp >= 0;
      case '>':
        return cmp > 0;
      case '<=':
        return cmp <= 0;
      case '<':
        return cmp < 0;
      default:
        return cmp === 0;
    }
  });
}
