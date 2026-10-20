# Feature flow: the route

The order of the agents, what each one is handed, and what the main session does between them. Each
agent's own contract is its file in the plugin's `agents/` folder; this file is only the route. The
prompt for every stage is in [handoffs.md](handoffs.md).

Agent names are scoped (they are plugin components): the Agent tool takes them as `subagent_type`, for
example `sdd-engineering:implementer` or `architecture-review:architecture-reviewer`. A bare name such as
`implementer` is not found. `check-plan.mjs` below is `${CLAUDE_SKILL_DIR}/assets/check-plan.mjs`.

## The one rule

**The main session routes; it does not build.** It passes paths, relays questions, records the user's
decisions in `Status:` lines and starts the next agent. It never writes feature code, never pastes a plan,
a diff or a report into a prompt, and never skips a gate the user owns.

## Principles

1. **Files are the handoff.** Spec, brief and plan are written by their agents straight to disk; an agent
   gets a path and reads what it needs. A role split loses context at each handoff unless the artifact
   stands on its own, and every pasted copy is re-read on every later call of whoever holds it.
2. **Two gates belong to the user.** `Status: approved` on the spec and on the plan. Nothing is planned from
   a draft spec or built from a draft plan; agents and `check-plan.mjs` stop on one. A wrong requirement is
   cheapest to fix before it becomes steps, and a wrong step before it becomes code.
3. **Requirements trace by id.** A spec id (`AC-n`, `EC-n`, `NFR-n`) appears on a plan step's `Covers`
   line and in the verifier's matrix. Coverage becomes a search, not a judgement, and a missing id is
   caught by a script before any code exists.
4. **New tests are off unless the user asks.** By default `sdd-engineering:implementer` only repairs the tests
   its change breaks, and the closing report says so. When the user asks for tests, the main session passes
   `tests: on` to every implementer and to the verifier, in `multi-agent` and `single-agent` runs alike: the
   implementer of a step's group writes that step's `Tests (new)`. There is no test-writing stage.
5. **Architecture is reviewed, fixed and rechecked.** `architecture-review:architecture-reviewer` reads the
   diff; its findings go to one fix-mode `implementer` per round, and the reviewer then rechecks only what
   the fix touched. An architecture fix moves code between layers, which is where new violations appear.
6. **The verifier is the last gate, on a tree that no longer moves.** It runs after the fixes, and any later
   fix is followed by `recheck:`. A PASS on code that then changes is not a PASS.
7. **Fix loops are bounded.** Three rounds in the review loop, two at the verifier, then stop and show the
   user what is left. A loop that does not converge is a plan or spec problem, and more rounds only cost.
8. **Fresh context where it is cheap.** One `implementer` per step group; a new main session for
   execution, started from a short handoff note. Cost is context length times calls.

## Stages

| # | Stage | Agent(s) | Hand it | Gate before the next stage |
|---|---|---|---|---|
| 1 | Spec | `sdd-engineering:spec-creator`, 2 passes (it runs up to 4 `research-tools:researcher` in parallel itself) | the request + its sources; then the answers by `SendMessage` | **user sets the spec `approved`** |
| 2 | Options | `sdd-engineering:brainstorm` | the spec path | user picks; you set the brief `Status: chosen: option <k>` |
| 3 | Plan | `sdd-engineering:implementation-planner` | spec + brief paths; then the answers and the mode by `SendMessage` | `check-plan.mjs` clean; **user approves; you set the plan `approved`** |
| 4 | Build | `sdd-engineering:implementer`, one per step group | plan path · `group: G<n>` · the previous group's handoff | every group reports its checks |
| 5 | Review | `architecture-review:architecture-reviewer` | `mode: diff` · `base` · plan path · `checks:` | - |
| 6 | Review loop | one `implementer` in fix mode, then the reviewer with `recheck:`; up to 3 rounds | the fix list; then what is still open | no open CRITICAL or WARNING; the checks pass |
| 7 | Verify | `sdd-engineering:implementation-verifier` | plan path · `base` · `tests: off` (`tests: on` when the user asked for tests) | **PASS** |

The run ends with the closing report after stage 7. A correctness review, a security
review, documentation and a pull-request self-review are not stages of this plugin.

`single-agent` plans skip stages 5-7: one `implementer` does group `G1` with its own checks, and the
closing report says that no review or verification ran. (Run `implementation-verifier` on the plan on
request.)

**One agent on request.** When the user asks for one agent by name ("only the spec", "run spec-creator",
"just plan this", `--only spec|plan`), run that agent alone: relay its questions, let it write its file,
report, and stop. Do not go on to the next stage and do not insist on the stages before it: a standalone
`implementation-planner` needs no brainstorm brief (it plans from an approved spec or from the request).
The status gates still hold.

## Which stage is this feature in?

| You find | Stage | Next |
|---|---|---|
| No spec for the feature | 1 | `spec-creator` |
| Spec `Status: draft` | 1 | The user reviews and approves it |
| Spec `approved`, no `<plans_dir>/NN-*.brainstorm.md` | 2 | `brainstorm` |
| Brief `Status: awaiting choice` | 2 | The user picks an option |
| Brief `chosen: option <k>`, no plan | 3 | `implementation-planner` |
| Plan `Status: draft` | 3 | `check-plan.mjs`, then the user approves |
| Plan `approved` | 4 | Pre-flight, then the first group |
| Plan `in progress` | 4-6 | The implementation reports say which groups are done; `git status` shows the rest |
| Plan `implemented` / `partial` | 5-7 | Review loop if it has not run, then the verifier |

A fix or a small feature with no spec starts at stage 2 or 3 with the request as the requirements.

| File | Statuses | Who writes them |
|---|---|---|
| Spec (`Spec ID:` line) | `draft` -> `approved` -> `implemented` | `spec-creator` · the user (or the main session on their word) · `implementer` |
| Brief | `awaiting choice` -> `chosen: option <k>` | `brainstorm` · the main session after the user picks |
| Plan | `draft` -> `approved` -> `in progress` -> `implemented` or `partial` | `implementation-planner` · the main session on the user's word · `implementer` |

Hooks of the plugin keep the spec a draft in `spec-creator`'s hands and let the planner and `brainstorm`
write only their own draft file. `check-plan.mjs` fails a plan whose spec is not approved, and (`--implemented`, `P2`) a
finished plan whose spec is not `implemented`. The implementer of the last group sets both the plan and the spec
status; the main session never does, and no plan step does.

## Workflow (copy and tick off)

```
Planning session
- [ ] 1. spec-creator pass 1 -> relay questions (AskUserQuestion, options 1/2/3) -> SendMessage -> draft spec
- [ ] 2. User approves the spec (their edit, or yours on their word)
- [ ] 3. brainstorm -> relay its summary -> user picks -> set `Status: chosen: option <k>` in the brief
- [ ] 4. implementation-planner -> relay the Requirements review -> SendMessage -> plan file
- [ ] 5. node check-plan.mjs <plan>  -> no errors
- [ ] 6. User approves the plan -> set `Status: approved` -> write the handoff note -> new session

Execution session
- [ ] 7. Pre-flight (below): plan approved · tools and services the checks need · note `base`
- [ ] 8. implementer per group, in order; disjoint packages in one message. Plan deviation -> stop, back to the planner
- [ ] 9. architecture-review:architecture-reviewer
- [ ] 10. Review loop, max 3 rounds: CRITICAL/WARNING findings with `in_change: true` and failed checks ->
          ONE implementer in fix mode -> architecture-reviewer `recheck:` -> repeat with what is still open
          or new. Still open after round 3 -> stop and ask
- [ ] 11. implementation-verifier -> FAIL: fix mode with "To reach PASS", then verifier `recheck: <ids>` (max 2 rounds)
- [ ] 12. Closing report
```

## Pre-flight (before stage 4)

```sh
git status --short                                   # know what is already changed
git merge-base HEAD <default branch>                 # <base> for every later agent
node "${CLAUDE_SKILL_DIR}/assets/check-plan.mjs" <plans_dir>/NN-name.md
```

- **Default branch.** `git symbolic-ref --short refs/remotes/origin/HEAD`, falling back to `main`, then
  `master`.
- **Check commands.** They come from the `check_commands` option, else from the plan's Verification
  section. If neither names a command, the implementer and the verifier report "checks not run: no commands
  configured"; tell the user before building.
- **External services.** If the plan's Verification section says the checks need a database or a browser
  and it is not running, ask the user to start it. Never start or reset services yourself. Without it the
  items that need it end as "cannot verify" and the verdict is INCOMPLETE.
- **Dependencies.** A fresh git worktree has no installed dependencies; checks then fail to run. Ask the
  user to install them first.

## The handoff note (planning session -> execution session)

The planning session ends with a note of about ten lines; the execution session starts from it, with this
command, instead of resuming a long context:

```
Feature: <name> · Spec: <specs_dir>/NN-name.md (approved) · Plan: <plans_dir>/NN-name.md (approved)
Mode: multi-agent · Groups: G1 (backend, steps 1-4) -> G2 || G3 ...
Needs external services: yes/no
Decisions not in the files: <anything the user said that the spec and plan do not record; ideally "none">
Next: pre-flight, then G1
```

## When something comes back wrong

| Report | Do |
|---|---|
| Clarification / Spec discovery / Requirements review | Relay with `AskUserQuestion`; answer the **same** agent with `SendMessage` (it keeps what it read) |
| Plan deviation (implementer) | Stop the groups. Set the plan back to `draft` on the user's word, send the deviation to the planner, re-approve |
| A gap in the approved spec (planner recommendation, deviation, a criterion that cannot be met) | The user decides it -> `spec-creator` with `amend: <spec>` -> user approves again -> planner adds the new ids |
| Verifier INCOMPLETE | Show the "Cannot verify" list. A service that is down -> ask the user to start it and `recheck:`; otherwise the user decides |
| The round limit is reached (3 in the review loop, 2 at the verifier) | Stop. Show what is left and ask: change the plan, amend the spec, or accept |

## Check

```sh
node "${CLAUDE_SKILL_DIR}/assets/check-plan.mjs" <plans_dir>/NN-name.md                 # form + spec coverage
node "${CLAUDE_SKILL_DIR}/assets/check-plan.mjs" <plans_dir>/NN-name.md --implemented   # after the build
node "${CLAUDE_SKILL_DIR}/assets/tests/check-plan.test.mjs"                             # the script's tests
```

The first is the planner's PostToolUse hook (`--hook`); the second is what `implementation-verifier` runs
for its mechanical items. Both check form and traceability only. The folders come from the `plans_dir` and
`specs_dir` options (`--plans-dir` / `--specs-dir` override them), the defaults are `docs/plans` and
`specs`.

## Closing report

In the user's language: what was built (spec id, plan path) · the new tests written (`tests: on`) or that none were (default) · the
verifier's verdict line · the findings that were not fixed (warnings, `in_change: false`,
`untested-requirement`) · what was not run and why · that tests, correctness and security review,
documentation and the pull-request step are outside this plugin, and that `/sdd-engineering:workflow-retro`
can measure the token spend of the run (never quote a token total from completion notices).
