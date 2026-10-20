# Handoffs: what each agent is given

Prompts carry paths and a few fields, never file contents, a diff or another agent's full report.
`<base>` is the sha noted in the pre-flight (`git merge-base HEAD <default branch>`). Agents are started
with the Agent tool, `subagent_type` set to the scoped name in the first column.

Every prompt also carries the resolved folders, one per line: `specs_dir: <dir>` and `plans_dir: <dir>`
(see "Settings" in SKILL.md). `checks:` is added only when the user gave commands in the request.

## Planning

| Agent | Prompt | Comes back | You then |
|---|---|---|---|
| `sdd-engineering:spec-creator` pass 1 | The feature request in the user's words + every source (brief, Figma links, design files, code paths, related specs) | Spec discovery report | Relay questions and proposals with `AskUserQuestion` (numbered options, recommended first) |
| `sdd-engineering:spec-creator` pass 2 | `SendMessage` to the same agent: the answers, by question number | Spec report; the draft is on disk | Ask the user to review and approve it |
| `sdd-engineering:spec-creator` amendment | A **new** `spec-creator` (Agent tool, not `SendMessage` to the pass-1 agent): `amend: <spec path>` + the gap + the user's decision | Spec report; the spec is a draft again | The user approves it again |
| `sdd-engineering:brainstorm` | `Spec: <path>` (or the problem, for a fix with no spec) | Brief summary; the brief is on disk | Show the options; after the choice, edit the brief's `Status:` to `chosen: option <k>` |
| `sdd-engineering:implementation-planner` | `Spec: <path>` · `Brainstorm: <path>` · `mode:` if the user already said | Requirements review, or the Plan summary | Relay the review; answer with `SendMessage` |
| `sdd-engineering:implementation-planner` corrections | `SendMessage`: what to change. The plan must be `draft` | Plan summary with "Changed since" | Run `check-plan.mjs`; ask for approval |

Why a new agent for an amendment: it needs the spec file and the gap, not the discovery context, and the
pass-1 agent's cache has expired by then, so resuming it writes its whole context again.

Approving: the user may edit the `Status:` line, or tell you to. Write `approved` only on an explicit yes
for that file. Never infer approval from "looks good so far".

## Execution

| Stage | Agent | Prompt |
|---|---|---|
| 4 | `sdd-engineering:implementer` | `Plan: <plans_dir>/NN-name.md` · `group: G2` · `tests: on` only when the user asked for tests · `Handoff from G1:` the previous report's "Handoff to the next group" section, verbatim |
| 5 | `architecture-review:architecture-reviewer` | `mode: diff` · `base: <base>` · `Plan: <path>` · `checks:` the `architecture_checks` entries, one per line, when there are any |
| 6 | `sdd-engineering:implementer` | `Fix mode.` · `Plan: <path>` · `tests: on` only when the user asked for tests · the fix list, one line per item: `<id>` · `path:line` - what is wrong - what the rule or criterion requires |
| 6 | `architecture-review:architecture-reviewer` again | `mode: diff` · `base: <base>` · `recheck:` the findings that were sent to the fix, one line each: `<id>` · `file:line` · `rule` · `fixed_files:` the fix report's changed files |
| 7 | `sdd-engineering:implementation-verifier` | `Plan: <path>` · `base: <base>` · `tests: off` (`tests: on` when the user asked for tests) |
| 7 | `sdd-engineering:implementation-verifier` again | the same + `recheck: AC-3, S4.done, ...` |

### Stage 4: groups

Run the groups in the order of the plan's "Step groups" table. Groups whose "Runs after" is the same and
whose packages are disjoint go out in one message. A group that is not the last runs the cheap checks of
the plan's Verification section itself; the last one runs the full checks. Do not resume a finished
implementer for the next group: start a new one.

### One agent on request

| The user asks for | Run | Stop after |
|---|---|---|
| only the spec (`--only spec`, "run spec-creator", "just write the spec") | `spec-creator`, both passes | the Spec report: the draft is on disk, the user reviews it |
| only the plan (`--only plan`, "run the planner", "just plan this") | `implementation-planner` with the spec path or the request, and a brief only if one exists | the Plan summary and a clean `check-plan.mjs` |

No brainstorm before a standalone planner, no next stage after either. The gates hold: a spec with a
`Spec ID:` line must be approved before it is planned.

### Tests: off by default, on when the user asks

By default the route writes no new tests: the verifier gets `tests: off`, and the closing report says the
feature has no new tests. `implementer` still repairs the existing tests its change breaks.

When the user asks for tests (in the request or any later message), add `tests: on` to the prompt of every
`implementer` (each group, and fix mode) and of the verifier, whatever the execution mode. Each implementer
writes the `Tests (new)` of the steps in its own group, so a step's tests are written by the agent that wrote
its code; the planner needs no separate test step. The line is one flag, not the tests themselves: never
paste test text into a prompt.

### Stage 5: the architecture review

`architecture-reviewer` returns one JSON object. A reply with `clarification` instead of `findings` is
relayed to the user like any other clarification.

### Stage 6: the review loop

Round 1 turns the reviewer's JSON into one fix list:

| From `findings` / `checks` | Goes to the fix list | Does not |
|---|---|---|
| severity CRITICAL or WARNING with `in_change: true` | yes | |
| a failed check (`rule: check-failed: <cmd>`) | yes | |
| SUGGESTION, or `in_change: false` | | list them for the user at the end |

Then, per round:

1. One `implementer` in fix mode gets the list, with the architecture ids (`A1` ...) as they are.
2. `architecture-reviewer` runs with `recheck:`: the findings just sent, and `fixed_files:` from the fix
   report's "Changed files". It answers `closed` or `open` per id (under `rechecked`) and reports new
   CRITICAL and WARNING findings in those files.
3. Nothing open and nothing new: the loop is done. Otherwise the open and new findings are the next
   round's list.

At most **3 rounds**. After the third with something still open, stop and ask the user: change the plan,
accept the rest and go on to verify, or one more round. An empty list in round 1 skips the loop. Two
findings on the same line are one item. Do not fix anything yourself, and do not re-argue a finding: the
fix-mode implementer reports under "Deviations" when the code contradicts one, and that finding goes to
the user, not into another round.

### Stage 7: the verifier's rounds

A round is: fix-mode `implementer` with the verifier's "To reach PASS" list as it stands, then the
verifier again with `recheck:` and the ids of that list and of "Cannot verify". Count the rounds. After the
second failed round, stop and ask the user.

## Closing report to the user

See "Closing report" in [feature-flow.md](feature-flow.md).
