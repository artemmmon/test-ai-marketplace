# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the plugin uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
