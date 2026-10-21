# Insights

Append-only notes on what this module taught us the hard way. Entries: `### YYYY-MM-DD — title`, 1–4 lines,
closing with `Where: <path>:<line>`. Keep one entry per finding and never rewrite old ones.

## What Works

## What Doesn't Work

### 2026-10-21 — Driving another repository from this session: the write guards block the agents
The guards resolve `specs_dir` and `plans_dir` against the session's project root, not the repository the prompt names. `spec-creator` started from `test-ai-marketplace` and told to write `/…/dev-digest/specs/16-agent-performance.md` was refused ("is outside the spec folder"), although the path was absolute and correct. The guard is right: the agent's working directory is the thing it protects. Run `/sdd-engineering:run-plan` from a session opened in the target repository; if you must drive from elsewhere, the agent returns the file text and the main session writes it.
Where: scripts/guard-lib.mjs:44

## Codebase Patterns

## Tool & Library Notes

## Recurring Errors & Fixes

## Open Questions

## Session Notes
