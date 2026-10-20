---
name: engineering-insights
description: Appends non-obvious engineering findings to the INSIGHTS.md of the module or package being worked on, so the next session starts with what this one learned. Use proactively in any session, without being asked, the moment you hit a dead end, a library or tool quirk, an error and its fix, an unwritten codebase convention, a decision with a tradeoff or an unresolved question, and before finishing a session where any of these happened. Also for reading, correcting or superseding an existing insight. Not for routine edits, for facts already visible in the code or the docs, or for status reports.
---

# Engineering insights

A short, append-only log of what a session learned the hard way, kept next to the code it is about.
The file is optional: no project has to keep one, and this skill creates it when the first finding is worth keeping.

## The rules

1. **Filter.** Skip routine edits, trivial fixes and anything obvious to someone reading the code, or already
   written in the project's agent instructions file (such as `AGENTS.md` or `CLAUDE.md`, if it exists),
   in `docs/`, or in the target file. For a tradeoff decision, record why the rejected option lost.
2. **File.** The `INSIGHTS.md` of the module or package the finding is about, if there is one nearby;
   most specific wins: the module's folder, then the package, then the repository root. The root file is
   for findings that span modules. When the target does not exist yet, create it from
   [assets/INSIGHTS.template.md](assets/INSIGHTS.template.md) (the headings below, nothing else).
3. **Section.** Exactly one, as `##` headings in this order: What Works · What Doesn't Work ·
   Codebase Patterns · Tool & Library Notes · Recurring Errors & Fixes · Open Questions · Session Notes
   (one dated summary, only for a session that added other entries).
4. **Append-only.** Add at the end of the section. Never edit, reorder or delete entries. A finding proven
   wrong gets a new entry titled `Supersedes "<old title>"`. This governs the *claim*, not its pointers: a
   `Where:` whose file moved or whose line drifted is stale metadata, so repair it in place.
5. **Entry.** `### YYYY-MM-DD — short title`, then 1–4 lines: context → problem → what to do, closing with
   `Where: <path>:<line>`. Every entry has one, Session Notes included, and at least one anchor carries a
   line number: open the file and read it off, never guess. A bare path is for a finding about the file or
   directory as a whole. Paths are relative to the package that owns the file (relative to the repository
   root in the root file). Write it so it is actionable cold: name the file, function or command and the
   concrete action. Mark claims you have not checked **(unverified)**.
6. **Report.** Tell the user in one line: file and section. When the finding will bite every task in that
   module, suggest promoting a one-line version to the agent instructions file's gotchas, if the project has
   one; do not edit that file yourself.

## Reading before writing

Before adding an entry, search the target for the module, file or symbol you are about to write about
(`rg -n -i '<term>' <path>/INSIGHTS.md`) and read the matching entries only. If the finding is already
there, add nothing. If the older entry is now wrong, supersede it (rule 4).

## Bad vs good

Bad: Be careful with schema validation errors.
Good: `instanceof ValidationError` misses errors thrown from the `billing` package: the service bundles a
second copy of the validation library. Match by shape (an `issues` array) instead.
`Where: src/http/error-handler.ts:42`

Bad: Background jobs can be flaky.
Good: `queue.enqueue()` returns a `done` promise that nobody catches; on Node 22 a failed job may end the
process **(unverified)**. `Where: src/jobs/queue.ts:17`

Bad: The React app has a caching problem.
Good: `useProjects()` keys its query by `orgId` only, so switching the active project shows stale rows until a
refetch. Add `projectId` to the key. `Where: src/hooks/useProjects.ts:23`

## A complete entry

```md
## Recurring Errors & Fixes

### 2026-10-20 — ESM import fails in the CLI after a build
`dist/cli.js` imports `./util` without an extension and Node 22 refuses to resolve it. Import `./util.js`
in the source (TypeScript keeps the extension as written). Where: src/cli.ts:3
```
