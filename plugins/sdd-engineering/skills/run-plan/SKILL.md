---
name: run-plan
description: The /sdd-engineering:run-plan command - starts or continues one feature in Spec Driven Development from whatever the user hands over (a spec path, a plan path, Figma links or design files, a free-text requirements prompt, in any mix), works out which stage the feature is in, and drives it through the route spec -> brainstorm -> plan -> build -> architecture review loop -> verification, with the two approvals (spec, plan) asked for every time. Flags --only spec|plan, --mode multi|single, --from and --until pick the stages. Run by the user; Claude does not start it on its own. Not for a one-file change, for writing a spec by hand (spec-authoring), or for steps after verification (tests, security review, docs, pull request), which are outside this plugin.
argument-hint: "[spec.md | plan.md] [design paths | Figma links] [\"requirements text\"] [--only spec|plan] [--mode multi|single] [--from <stage>] [--until <stage>]"
disable-model-invocation: true
---

# /sdd-engineering:run-plan - run a feature spec-first

This command is the entry. The route (stages, gates, prompts, fix loops) is in
[references/feature-flow.md](references/feature-flow.md) and the exact prompt for each agent in
[references/handoffs.md](references/handoffs.md). **Read `feature-flow.md` now** (Read tool, path
`${CLAUDE_SKILL_DIR}/references/feature-flow.md`) and keep to it: its one rule (the main session
routes, it does not build), its stage table, its gates. This file decides *where to start* and *when to
stop and ask*.

Arguments: `$ARGUMENTS`

## The one rule

**Start from the latest artifact that is approved, never behind it and never past a gate.** What the
user passed decides the entry stage; the two approvals (spec, plan) are asked for every time and are
never inferred from the fact that `run-plan` was run.

## Where the run ends

The run ends with a report after `sdd-engineering:implementation-verifier`. Writing tests, a correctness
review, a security review, documentation and a pull-request self-review are **outside this plugin**: this
command does not run them and says so in the closing report. The code is not
committed, pushed or opened as a pull request.

## Settings

Project settings come from the user's words first, then from the plugin options, then from the built-in
default. An option value that is empty, or that still begins with a dollar sign and an opening brace,
means nothing was saved: use the default. Paths are relative to the repository root.

| Setting | Plugin option | Default |
|---|---|---|
| `specs_dir` | `${user_config.specs_dir}` | `specs` |
| `plans_dir` | `${user_config.plans_dir}` | `docs/plans` |
| `architecture_checks` | `${user_config.architecture_checks}` (entries joined by commas) | none |

Pass the resolved `specs_dir:` and `plans_dir:` as lines in every agent prompt, so a run does not depend
on what each agent can read. `check_commands` is read by `implementer` and `implementation-verifier`
themselves; pass `checks:` only when the user gave commands in the request. `architecture_checks` go to
`architecture-review:architecture-reviewer` as its `checks:` list; with none, omit the line and the
reviewer runs nothing.

## 1. Sort the arguments

| Argument looks like | It is | Goes to |
|---|---|---|
| `<specs_dir>/NN-*.md` | the spec | every stage |
| `<plans_dir>/NN-*.md` (not `.brainstorm.md`) | the plan | execution; its `Spec:` line names the spec |
| `<plans_dir>/NN-*.brainstorm.md` | the brief | the planner |
| a Figma URL, an image or PDF path, a path in a design folder | a design source | `sdd-engineering:spec-creator` |
| any other existing path (code, a doc) | a context source | `sdd-engineering:spec-creator` |
| everything else | the requirements text | `sdd-engineering:spec-creator`, or see step 3 |
| `--only spec` / `--only plan` | run one agent and stop | `spec-creator` alone, or `implementation-planner` alone (no brainstorm before it, nothing after) |
| `--mode multi\|single` | execution mode | the planner (it then does not ask) |
| `--from <stage>` / `--until <stage>` | stage names: `spec` `brainstorm` `plan` `build` `review` `verify` | overrides step 2 / stops after that stage |

A path that does not exist is a question to the user, not a guess. No arguments at all: look for a
feature in flight (`ls <specs_dir> <plans_dir>`, statuses) and ask which one, or what to build.

## 2. Find the entry stage

`--only` skips this table: `--only spec` starts `spec-creator` (pass 1, or changes to a draft, or `amend:`
for an approved spec, after asking); `--only plan` starts `implementation-planner` with the spec, the
brief if one exists, and the text. Each ends with that agent's report. The same holds when the
requirements text itself says "only the spec" or "only the plan".

Read the `Status:` line of what was passed (and of the plan's spec and brief), then take the first row
that matches.

| Found | Start at |
|---|---|
| Plan `implemented` / `partial` | review loop if it has not run, else verify |
| Plan `in progress` | build: the first group with no Implementation report and unchanged files (`git status`); ask when unsure |
| Plan `approved` | pre-flight, then build |
| Plan `draft` | plan check, then ask for approval |
| Brief `chosen` and spec `approved` | plan |
| Spec `approved`, no brief | brainstorm |
| Spec `draft` | spec: the user reviews it; new text or designs go to `spec-creator` as changes |
| No spec | spec: `spec-creator` pass 1 with the text and every design and context source |

## 3. Three cases that need a question first

Ask with `AskUserQuestion`, numbered options, the recommended one first:

- **Text or designs came with an `approved` spec.** They may change what is built. Options: 1. amend the
  spec (`spec-creator` with `amend:`, re-approval), recommended when it adds or changes behaviour; 2. pass
  it to the planner as a note on *how* to build; 3. ignore it.
- **The feature has UI and no design source was passed** (and the spec does not name one). Options: 1. the
  user gives a Figma link or a design path; 2. build from the existing screens, and `spec-creator` lists
  what is undefined.
- **`--from` skips a gate** (for example `--from build` with a draft plan). Do not skip: say which approval
  is missing and ask for it.

## 4. Run

Follow the checklist in `feature-flow.md` from the entry stage. What this command adds on top:

```
- [ ] Say in one line what was understood: spec · plan · designs · text · entry stage · mode
- [ ] Planning stages: relay every question; write `approved` only on an explicit yes for that file
- [ ] After the plan is approved: write the handoff note, then ASK - continue here, or stop so the user
      runs `/sdd-engineering:run-plan <plans_dir>/NN-name.md` in a fresh session (recommended after long planning)
- [ ] Build, then the review loop (below), at most 3 rounds
- [ ] Verify, with its own fix rounds (at most 2)
- [ ] Closing report. Never push, commit or open a pull request
```

### The review loop

After `architecture-review:architecture-reviewer` returns its JSON:

| Round | Fix list for ONE fix-mode `sdd-engineering:implementer` | Then |
|---|---|---|
| 1 | findings with severity CRITICAL or WARNING and `in_change: true`, and every failed check (`check-failed`) | `architecture-reviewer` with `recheck:` |
| 2, 3 | what the recheck reports as still `open`, plus its new CRITICAL and WARNING findings | `architecture-reviewer` with `recheck:` |

- The loop ends when a recheck returns nothing open and no new CRITICAL or WARNING. An empty list in round
  1 skips the loop.
- `recheck:` gives the reviewer its earlier findings (`id` · `file:line` · `rule`) and the fix report's
  changed files; it re-reads only those. Prompt shape: `references/handoffs.md`.
- SUGGESTIONs and `in_change: false` findings are never fixed here: collect them for the closing report.
- **After round 3 with something still open: stop.** Show the open findings and ask: 1. change the plan
  (back to the planner); 2. accept them and go on to verify; 3. one more round.
- The verifier starts only after the loop has ended and the last fix's checks passed.

## Out of scope

- The order of the stages, prompts, pre-flight, the verifier's fix rounds: `references/feature-flow.md`.
- What a spec says and how it is worded: `sdd-engineering:spec-authoring`.
- Tests, correctness and security review, documentation, a pull-request self-review, committing, pushing:
  not part of this plugin; the user does them with other tools.
- More than one feature per run: one `run-plan`, one spec.
