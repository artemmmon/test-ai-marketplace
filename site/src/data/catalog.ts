// Data access: every URL is built from import.meta.env.BASE_URL (spec FR-71).
import type { IndexFile, ReleasesFile } from '../types';

const BASE = import.meta.env.BASE_URL;

/** Absolute-to-origin URL of a file served next to the site (public/ or dist/). */
export function asset(path: string): string {
  return BASE + path.replace(/^\/+/, '');
}

async function fetchOk(path: string): Promise<Response> {
  const res = await fetch(asset(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res;
}

let indexPromise: Promise<IndexFile> | null = null;

/** index.json is fetched once per session; a failed load can be retried. */
export function loadIndex(): Promise<IndexFile> {
  indexPromise ??= fetchOk('index.json')
    .then((r) => r.json() as Promise<IndexFile>)
    .catch((err) => {
      indexPromise = null;
      throw err;
    });
  return indexPromise;
}

let releasesPromise: Promise<ReleasesFile> | null = null;

export function loadReleases(): Promise<ReleasesFile> {
  releasesPromise ??= fetchOk('releases.json')
    .then((r) => r.json() as Promise<ReleasesFile>)
    .catch((err) => {
      releasesPromise = null;
      throw err;
    });
  return releasesPromise;
}

const bodies = new Map<string, Promise<string>>();

/** Lazy body files (bodies/...), cached in memory. */
export function loadBody(ref: string): Promise<string> {
  let p = bodies.get(ref);
  if (!p) {
    p = fetchOk(ref)
      .then((r) => r.text())
      .catch((err) => {
        bodies.delete(ref);
        throw err;
      });
    bodies.set(ref, p);
  }
  return p;
}
