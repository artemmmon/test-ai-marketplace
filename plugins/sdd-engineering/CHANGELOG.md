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
