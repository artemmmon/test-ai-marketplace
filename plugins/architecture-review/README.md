# architecture-review

A read-only architecture reviewer agent for Claude Code.

## What it provides

| Component | Name | Model | Tools |
|---|---|---|---|
| Agent | `architecture-review:architecture-reviewer` | sonnet | Read, Grep, Glob, Bash |

`Write`, `Edit`, `NotebookEdit`, `Agent`, `WebSearch` and `WebFetch` are disallowed. The agent is told to use
`Bash` only for read-only git and search commands plus the commands you pass as `checks`; that restriction is an
instruction in the agent prompt, not a technical sandbox. It records `git status --porcelain` before and after its
run and reports whether the two differ.

The agent audits structure across a whole slice: module boundaries, dependency direction, the composition root,
cycles, the route -> service -> repository chain, feature-to-feature imports and cross-package imports. It runs the
mechanical checks you give it first, then applies the rubric as judgement. It does not review style, performance or
security.

The rubric comes from two skills in `engineering-paved-path`, preloaded into the agent:

- `engineering-paved-path:onion-architecture` for backend code,
- `engineering-paved-path:frontend-architecture` for UI code.

The agent picks the rubric from what `target` (or the diff) contains, not from folder names.

## Input contract

Send a prompt with one of:

- `mode: diff` and optionally `base:` (default: the merge base with the default branch),
- `mode: module` and `target:` one or more paths (a module, a route or feature folder, or a whole package).

Optional inputs:

- `checks:` the commands the agent may run as mechanical checks (an architecture linter, a lint command, a type
  check), with the directory for each when it is not the repository root. Default: empty. With no `checks` the agent
  runs nothing, reports `"checks": []` and names the reason in `not_checked`. The agent never adds `--fix`,
  `--write` or `sync`.
- a plan path, to read the plan's hand-off line for the architecture reviewer.
- `recheck:` with the earlier findings and `fixed_files:`, after an implementer fixed them (only with `mode: diff`).
  The agent then reports each earlier finding as `closed` or `open` and reviews only the fixed files for new
  violations.

If the target is missing or ambiguous, the agent returns a clarification JSON and stops.

## Output

One JSON object and nothing else: `agent`, `mode`, `target`, `base`, `checks` (`pass`, `fail` or `not_run` per
command), `rubric_read`, `findings` (each with `id`, `severity`, `file`, `line`, `rule`, `title`, `evidence`, `why`,
`fix`, `in_change`), `rechecked`, `not_checked` and `git_status_unchanged`. Severity is CRITICAL only for a layer or
dependency-direction violation, a cross-package import that bypasses a public entry point, contract drift or a
failing check; everything else is WARNING or SUGGESTION. The schema is stable: other agents and skills parse it.

## Use

```
Use the architecture-review:architecture-reviewer agent:
mode: diff
base: main
checks:
  - npm run lint (in packages/api)
```

Other agents and skills should refer to it by its scoped name, `architecture-review:architecture-reviewer`.

## Install

```sh
claude plugin marketplace add artemmmon/test-ai-marketplace
claude plugin install architecture-review@test-ai-marketplace
```

`engineering-paved-path` is installed automatically as a dependency.

## Dependencies and version

Depends on `engineering-paved-path` `^1.0.0` for the two rubric skills. Without it the agent would silently lose
its rubric, so the dependency is declared. Current version: 1.0.0. See [CHANGELOG.md](CHANGELOG.md) and
[COMPATIBILITY.md](COMPATIBILITY.md).

## Sources

The agent is original work, extracted from the DevDigest project and generalized (no project-specific paths or
commands). Plugin license: MIT.
