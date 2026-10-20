# architecture-review

A read-only architecture reviewer for Claude Code. Point it at a branch diff or at a module, a feature folder or a
whole package and it audits the structure: layer and import direction, module boundaries, the composition root,
cycles, the route -> service -> repository chain, feature-to-feature imports and cross-package imports. It runs the
mechanical checks you give it first (an architecture linter, a lint command), applies the rules of the
architecture skills as judgement second, and returns one JSON object whose findings each carry a rule, a quoted
line and a suggested fix. It edits nothing.

## What you get

| Component | Name | Model | Tools |
|---|---|---|---|
| Agent | `architecture-review:architecture-reviewer` | sonnet | Read, Grep, Glob, Bash |

`Write`, `Edit`, `NotebookEdit`, `Agent`, `WebSearch` and `WebFetch` are disallowed. The agent is told to use `Bash`
only for read-only git and search commands (`git log`, `git show`, `git diff`, `git ls-files`, `git status`,
`git merge-base`, `ls`, `cat`, `sed -n`, `rg`, `grep`) plus the commands you pass as `checks`. That limit is an
instruction in the agent prompt, not a technical sandbox. The agent records `git status --porcelain` at the start
and at the end of its run and reports whether the two differ. The plugin has no skills, hooks or settings of its
own.

## Install

```sh
claude plugin marketplace add artemmmon/test-ai-marketplace
claude plugin install architecture-review@test-ai-marketplace
```

The dependency `engineering-paved-path` is installed automatically. To update later, see the root README of the
marketplace (`/plugin marketplace update test-ai-marketplace`, then `/reload-plugins`).

## How to use it

Ask Claude to use the agent by its scoped name, `architecture-review:architecture-reviewer`. Other agents start it
through the Agent tool with `subagent_type: architecture-review:architecture-reviewer`.

Review everything your branch changed:

```
Use the architecture-review:architecture-reviewer agent:
mode: diff
base: main
checks:
  - npm run lint
```

Audit one backend module, with no mechanical checks:

```
Use the architecture-review:architecture-reviewer agent:
mode: module
target: src/modules/billing
```

Audit a frontend feature and a backend module together (the agent picks the rubric for each part):

```
Use the architecture-review:architecture-reviewer agent:
mode: module
target: src/modules/billing, web/src/features/invoices
```

Check that a fix worked (`recheck:` is for `mode: diff`; the caller lists the findings it sent to the fix and the
files the fix changed):

```
Use the architecture-review:architecture-reviewer agent:
mode: diff
base: main
recheck:
  - A1 | src/modules/billing/routes.ts:42 | onion-layer-violation
  - A3 | src/modules/billing/service.ts:17 | cross-package-import
fixed_files: src/modules/billing/routes.ts, src/modules/billing/service.ts
```

## Inputs

| Input | Meaning | Default |
|---|---|---|
| `mode: diff` | Review the diff against `base` | `base` is the merge base with the default branch (`origin/HEAD`, then `main`, then `master`) |
| `mode: module` + `target:` | Review one or more paths: a module, a route or feature folder, a whole package | none, `target` is required |
| `checks:` | Commands the agent may run as mechanical checks, each with a directory when it is not the repository root | empty: nothing is run, the output has `"checks": []` and `not_checked` names the reason |
| a plan path | If the plan has a "Handed off -> Architecture reviewer" line, the agent reads what it flags as worth a look | none |
| `recheck:` + `fixed_files:` | Second or later run after a fix (only with `mode: diff`) | none |

The agent never adds `--fix`, `--write`, `sync` or any other flag that edits files. A command that looks as if it
would edit files is not run and is listed under `not_checked`. If the target is missing, ambiguous or does not
exist, the agent returns a clarification JSON and stops.

The rubric comes from what the code is, not from folder names: backend code (HTTP routes, services, repositories,
domain logic, persistence, a composition root) is judged by `engineering-paved-path:onion-architecture`, frontend
code (components, pages, hooks, client state, routing) by `engineering-paved-path:frontend-architecture`. Both
skills are preloaded. Project documents that declare known architectural debt or intentional exceptions override
the skills.

## What it returns

One JSON object and nothing else. The schema is stable, because other agents and skills parse it.

```json
{"agent":"architecture-reviewer","mode":"diff","target":["..."],"base":"<sha>",
 "checks":[{"cmd":"npm run lint","dir":".","result":"pass","excerpt":""}],
 "rubric_read":["onion-architecture/SKILL.md","onion-architecture/references/tools.md"],
 "findings":[{"id":"A1","severity":"CRITICAL","file":"src/modules/billing/routes.ts","line":42,
              "rule":"onion-layer-violation","title":"Route imports the ORM",
              "evidence":"import { db } from '../../db/client.js'","why":"...","fix":"...","in_change":true}],
 "rechecked":[],
 "not_checked":["frontend: no mechanical checks configured"],
 "git_status_unchanged":true}
```

| Field | Meaning |
|---|---|
| `checks` | One entry per command from `checks`: `pass`, `fail` or `not_run` with an excerpt |
| `findings` | Each has an `id` (`A1`, `A2`, ...), `severity`, `file`, `line`, `rule` (a skill principle or checklist item), verbatim `evidence` (at most 3 lines), `why`, `fix`, and `in_change` |
| `rechecked` | On a `recheck:` run, each earlier id as `closed` or `open`; empty on a first run |
| `not_checked` | Areas the agent could not check, each with the reason |
| `git_status_unchanged` | Proof that the run changed nothing |

Severity: CRITICAL only for a layer or dependency-direction violation (`onion-layer-violation`), an import across a
package boundary that bypasses its public entry point (`cross-package-import`), drift between copies of shared
contracts (`contract-drift`) or a failing mechanical check (`check-failed`). Everything else is WARNING or
SUGGESTION. A finding with no rule or no quoted line is not reported. In `module` mode findings outside the changed
code get `"in_change": false` and are informational.

## Dependencies

`engineering-paved-path` `^1.0.0`. The reviewer's rubric lives in two of its skills, which the agent preloads by
scoped name. Without the dependency Claude Code would skip the missing skills silently and the agent would lose its
rubric, so the dependency is declared and installed with the plugin. The `sdd-engineering` plugin depends on this
one and runs the reviewer in its review loop.

## What it deliberately does not do

- It does not edit code, apply fixes or run `--fix`/`sync` commands. Fixing is the caller's job.
- It does not review per-line style, naming polish, performance or security.
- It does not decide what is architecturally right for your project: the skills hold generic rules and the folder
  layout in them is an example. If your project has a `CLAUDE.md` or `AGENTS.md`, say there what your layout is and list accepted debt.
- It ships no default mechanical checks, because it cannot know your commands. Pass them in `checks:`.

## Requirements

Claude Code 2.1.269 or newer, and a git repository for `mode: diff`.

## License

MIT. The agent is original work.

## Links

- [CHANGELOG.md](CHANGELOG.md)
- [COMPATIBILITY.md](COMPATIBILITY.md)
