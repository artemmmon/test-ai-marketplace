#!/usr/bin/env node
// Site data generator (spec §3, §4): validates the marketplace, then writes index.json, catalog.json,
// releases.json, stats.json, llms.txt, feed.xml and bodies/ for the catalog site.
//
// Usage: node scripts/build-index.mjs [--root <dir>] [--out <dir>] [--tags-file <json>]
//                                     [--now <iso>] [--commit <sha>] [--fixture]
//
// Reads only .claude-plugin/marketplace.json and plugins/<name>/ (see lib/marketplace.mjs) plus git tags.
// With validation errors it exits 1 and writes nothing (FR-13).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { buildCatalog } from './lib/emit/catalog.mjs';
import { buildFeed } from './lib/emit/feed.mjs';
import { buildBodies, buildIndex } from './lib/emit/index.mjs';
import { buildLlms } from './lib/emit/llms.mjs';
import { buildReleasesFile } from './lib/emit/releases.mjs';
import { buildStats } from './lib/emit/stats.mjs';
import { readGitTags, readHeadCommit, readOriginSlug } from './lib/git.mjs';
import { analyze } from './lib/marketplace.mjs';
import { buildMarketplaceInfo } from './lib/site-info.mjs';

/** Everything the generator owns inside --out (FR-73). Nothing else there is ever touched. */
export const OUTPUT_FILES = ['index.json', 'catalog.json', 'releases.json', 'stats.json', 'llms.txt', 'feed.xml'];
export const OUTPUT_DIRS = ['bodies'];

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** ISO 8601 UTC without milliseconds, like "2026-10-19T12:00:00Z". */
export function formatNow(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid --now value "${value}" (expected an ISO 8601 date)`);
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function readTagsFile(path) {
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`cannot read tags file ${path}: ${e.message}`);
  }
  if (!Array.isArray(data) || data.some((t) => !t || typeof t.name !== 'string')) {
    throw new Error(`${path}: expected a JSON array of { "name", "date", "commit" } objects`);
  }
  return data.map((t) => ({ name: t.name, date: t.date ?? null, commit: t.commit ?? null }));
}

/**
 * Pure part of the generator: reads the checkout, returns the files to write (nothing is written here).
 * @param {{ root?: string, tags?: Array<object>|null, now?: string|Date, commit?: string|null, fixture?: boolean, slug?: string|null, env?: Record<string, string|undefined> }} options
 * @returns {{ errors: string[], warnings: Array<{file: string|null, message: string}>, files: Map<string, string>, summary: object|null }}
 */
export function generate({ root = '.', tags = null, now = new Date(), commit = null, fixture = false, slug = null, env = process.env } = {}) {
  const warnings = [];
  const generatedAt = formatNow(now);

  let tagList = tags;
  if (tagList === null) {
    tagList = readGitTags(root);
    if (tagList === null) {
      warnings.push({ file: null, message: 'could not read git tags (not a git checkout?), releases come from CHANGELOG.md only' });
      tagList = [];
    }
  }

  const data = analyze(root, { tags: tagList });
  warnings.unshift(...data.warnings);
  if (data.errors.length) return { errors: data.errors, warnings, files: new Map(), summary: null };

  let resolvedCommit = commit ?? env.GITHUB_SHA ?? readHeadCommit(root);
  if (!resolvedCommit) {
    warnings.push({ file: null, message: 'could not determine the commit SHA (pass --commit); commit is empty in the output' });
    resolvedCommit = '';
  }
  const owner = data.marketplace.owner;
  const ownerName = (typeof owner === 'string' ? owner : owner?.name) || 'unknown';
  const resolvedSlug = slug ?? env.GITHUB_REPOSITORY ?? readOriginSlug(root) ?? `${ownerName}/${data.marketplace.name}`;
  const info = buildMarketplaceInfo(data.marketplace, resolvedSlug);

  const index = buildIndex({ info, plugins: data.plugins, releases: data.releases, commit: resolvedCommit, generatedAt, fixture });
  const files = new Map();
  files.set('index.json', json(index));
  files.set('catalog.json', json(buildCatalog(index)));
  files.set('releases.json', json(buildReleasesFile({ releases: data.releases, commit: resolvedCommit, generatedAt })));
  files.set('stats.json', json(buildStats({ index, releases: data.releases })));
  files.set('llms.txt', buildLlms(index));
  files.set('feed.xml', buildFeed({ index, releases: data.releases }));
  for (const [path, text] of buildBodies(data.plugins)) files.set(path, text);

  const stats = JSON.parse(files.get('stats.json')).counts;
  return { errors: [], warnings, files, summary: { ...stats, bodies: files.size - OUTPUT_FILES.length } };
}

/** Deletes only the generator's own outputs in `outDir`, then writes `files`. */
export function writeOutputs(outDir, files) {
  mkdirSync(outDir, { recursive: true });
  for (const name of [...OUTPUT_FILES, ...OUTPUT_DIRS]) rmSync(join(outDir, name), { recursive: true, force: true });
  for (const [path, text] of files) {
    const target = join(outDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}

// GitHub Actions workflow commands (FR-17).
const escapeData = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProp = (s) => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

export function annotate(level, message, file = null) {
  return `::${level}${file ? ` file=${escapeProp(file)}` : ''}::${escapeData(message)}`;
}

export function main(argv = process.argv.slice(2), env = process.env) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        root: { type: 'string', default: '.' },
        out: { type: 'string', default: 'site/public' },
        'tags-file': { type: 'string' },
        now: { type: 'string' },
        commit: { type: 'string' },
        fixture: { type: 'boolean', default: false },
      },
      strict: true,
    }));
  } catch (e) {
    console.error(`build-index: ${e.message}`);
    console.error('usage: node scripts/build-index.mjs [--root <dir>] [--out <dir>] [--tags-file <json>] [--now <iso>] [--commit <sha>] [--fixture]');
    return 2;
  }

  const actions = env.GITHUB_ACTIONS === 'true';
  let result;
  try {
    result = generate({
      root: values.root,
      tags: values['tags-file'] ? readTagsFile(values['tags-file']) : null,
      now: values.now ?? new Date(),
      commit: values.commit ?? null,
      fixture: values.fixture,
      env,
    });
  } catch (e) {
    console.error(`build-index: ${e.message}`);
    return 1;
  }

  for (const w of result.warnings) {
    console.log(`warning: ${w.message}`);
    if (actions) console.log(annotate('warning', w.message, w.file));
  }
  if (result.errors.length) {
    console.error(result.errors.map((e) => `✘ ${e}`).join('\n'));
    if (actions) for (const e of result.errors) console.log(annotate('error', e));
    console.error(`build-index: ${result.errors.length} error(s), nothing was written`);
    return 1;
  }

  writeOutputs(values.out, result.files);
  const c = result.summary;
  console.log(
    `build-index: ${c.plugins} plugins, ${c.skills} skills, ${c.agents} agents, ${c.commands} commands, ${c.hooks} hooks, ` +
      `${c.mcp} MCP servers, ${c.releases} releases -> ${values.out} (${result.files.size} files)`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
