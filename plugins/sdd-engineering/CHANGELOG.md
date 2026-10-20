# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the plugin uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.1] - 2026-10-20

### Fixed

- The spec's `implemented` status now has one owner: `implementer` sets it, in the same pass as the plan's
  `implemented`, when it does the plan's last group (or the whole plan) and the plan implements a spec with a
  `Spec ID:` line; a `partial` plan leaves the spec `approved`. The implementer text, the planner's "Spec
  `Status` update" line (it no longer says that nothing edits the spec) and the route documents agree with
  `check-plan.mjs --implemented` (`P2`), so a correct build no longer fails the first verification round on
  a spec still `approved`. Tests: the spec-creator guard still blocks everyone but the implementer path and
  does not block the implementer; `P2` is covered for `implemented` and `partial` plans.
- New tests (`tests: on`) work in `multi-agent` plans too, no longer in `single-agent` plans only: the
  implementer of the group that holds a step writes that step's `Tests (new)`. `run-plan` passes `tests: on`
  to every implementer and to the verifier when the user asks for tests. README, `feature-flow.md`,
  `handoffs.md`, the planner and the implementer say the same.
- `implementation-verifier`: a "Done when" or check that is relative to a baseline ("no new analyze/lint
  issues") is `met` only against a baseline it can point to; with none it is `cannot verify`. A "Done when" that
  names a command or a manual run is `met` only on that output. On `recheck:` an item changes only on a new check
  or new evidence, quoted. The planner writes a `Baseline:` line in the Verification section (a known baseline, or
  "to be recorded", which the implementer of Step 1's group fills in before any edit); `check-plan.mjs` warns when
  a "Done when" is baseline-relative and the line is missing.
- `spec-authoring`, `spec-creator`: one `shall` and one response per criterion, with a good and a bad example, and a
  number, deadline or limit enters a criterion only when the user gave it; a proposed default goes into an open
  question (or an `NFR` once decided). The eval `spec-ears-from-vague-brief` went from 1 of 4 to 4 of 4.
  `check-spec.mjs` is unchanged: it already fails a criterion with other than one `shall` and warns on "and" after
  it; a check for buried numbers or comma lists would flag legitimate criteria.

## [1.1.0] - 2026-10-20

### Added

- Skill `engineering-insights`: an optional, append-only, per-module `INSIGHTS.md` log with a fixed section set, dated
  entries with a `Where: path:line` anchor, a filter for non-obvious findings, `(unverified)` marking and
  supersede-instead-of-edit; `assets/INSIGHTS.template.md` for a file that does not exist yet. Claude loads it
  on its own when a session hits a dead end, a quirk or an error and its fix.

### Changed

- `implementer` records what it learned by following `engineering-insights` (it creates the file when the
  project has none yet) instead of only editing files that already exist; reading stays conditional.
- `implementation-planner` lists findings under "Insights to record" using the same filter, also when the
  target file does not exist yet.

## [1.0.0] - 2026-10-20

### Added

- Agents `spec-creator`, `brainstorm`, `implementation-planner`, `implementer` and `implementation-verifier`.
- `hooks/hooks.json` with the spec-creator guard, the plans guard (planner and brainstorm) and the PostToolUse
  spec and plan checks; each acts only for its own agent.
- `userConfig`: `specs_dir`, `plans_dir`, `retro_ledger`, `check_commands`, `architecture_checks`.
- Dependencies on `engineering-paved-path`, `research-tools` and `architecture-review`, each `^1.0.0`.
- Skills:
  - `spec-authoring`: the spec template, EARS and design-gap references, a worked example and
    `assets/check-spec.mjs`, the spec form check (also run as a PostToolUse hook for `spec-creator`).
    Preloaded by `spec-creator`; `implementation-planner` and `implementation-verifier` read it by path.
  - `run-plan` (`/sdd-engineering:run-plan`): the entry point and the route from a spec, plan, designs or
    requirements text through brainstorm, plan, build, the architecture review loop and verification, with
    `assets/check-plan.mjs`, the plan form and spec-coverage check (also run as a PostToolUse hook for
    `implementation-planner`, and with `--implemented` by `implementation-verifier`). The run ends after
    verification; tests, security review, documentation and a pull-request self-review are outside this plugin.
  - `workflow-retro` (`/sdd-engineering:workflow-retro`): measures a finished run from the transcripts on
    disk and appends a row to the retro ledger (`retro.mjs`, `prices.json`).
- README with the dependency diagram, the route of `run-plan`, quick start, the `userConfig` table and its limits,
  the guards and the files to read before installing, cost-control principles and the spec lifecycle.
