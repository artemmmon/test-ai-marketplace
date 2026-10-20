# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the plugin uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
