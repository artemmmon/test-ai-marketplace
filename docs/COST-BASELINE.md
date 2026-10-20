# Cost baseline

What one real run of the `sdd-engineering` route costs, where the money goes, and how to measure it again. This is a
baseline from **one run**, not a benchmark: read the [limitations](#limitations) before quoting any number.

## Summary

- Run: `sdd-engineering` 1.1.0, the full route (`/sdd-engineering:run-plan`: spec, brainstorm, plan, build, review, verify)
  on a small task in a small Flutter/Dart sample app: reject an unknown `map` query value with a 400 response in the
  Dart server (about 40 changed lines in code and API docs), plus tests and an OpenAPI update.
- Route that produced the result: **$3.08** as reported by the CLI, **$3.15** by the retro script's list-price
  estimate. 7 headless turns, about 12 minutes of wall time, 10 agents, 100 model requests.
- The whole trial cost about **$3.83**, because a first attempt was discarded (see [Trial total](#trial-total)).
- **The main session (orchestration) is about 41% of the cost** ($1.28 of $3.15). The two spec and plan agents on the
  larger model are the next biggest items ($0.47 and $0.56).
- A single-agent run of the same task was **not measured**, so this document says nothing about how much cheaper that
  mode would have been.
- A later, shorter scenario (spec, brainstorm and plan only) was repeated 5 times on the unmodified plugin and 3 times
  with one change, to measure the run-to-run spread; see
  [Repeated baseline and one optimization](#repeated-baseline-and-one-optimization-2026-10-20). One run of it costs
  about $1.67 and varies by about 6%; the change tested there did not show a saving.

## What was measured and how

Two sources, which do not measure the same thing:

| Source | What it gives | Kind |
|---|---|---|
| `total_cost_usd` in the JSON that `claude -p --output-format json` prints for each turn | Cost of the session so far, as computed by the CLI. Per-turn cost is the difference between two consecutive values. | Reported by the CLI (still not a bill: it is the CLI's own calculation) |
| `workflow-retro` script (`retro.mjs`, shipped in `plugins/sdd-engineering/skills/workflow-retro/assets/`) | Requests, tool calls, tokens (input, output, cache read, cache write), time, files read, per agent, from the transcripts on disk, subagents included. A dollar column from token counts times `prices.json`. | Counts are read from the transcripts; **dollars are a list-price estimate** |

Which figures are which:

- **Reported:** `total_cost_usd` per turn and for the session (the $3.08 route figure and every figure in the per-turn
  table), and the cost of the extra runs outside the session.
- **Estimated:** every per-agent dollar figure, and the $3.15 total (token counts times list prices in `prices.json`,
  dated 2026-09-24; the cache-read price for the smaller model is an assumption noted in that file). Output tokens of 2
  of the 100 requests are themselves estimated by the script (response length divided by 4); input and cache numbers are
  exact.
- **Read from the transcripts, not estimated:** requests, tool calls, token counts, which files each agent read.
- **Wall time:** measured with the shell clock around each `claude -p` call (the sum of the 7 turns), and, separately,
  the span between the first and last request in the transcripts (retro).

The retro script was run read-only (no `--write`), so this run is not in a retro ledger.

## Per-stage cost

One row per stage of the route. Dollars are the retro estimate. Tokens include cache reads and writes. Wall time is the
agent's own time from the transcripts.

| Stage | Agent | Model | Requests | Tokens | Est. $ | Agent time |
|---|---|---|---|---|---|---|
| 1. Spec (two passes, same agent) | `sdd-engineering:spec-creator` | opus-5-5 | 8 | 289K | 0.47 | about 3 min |
| 2. Brainstorm | `sdd-engineering:brainstorm` | sonnet-5-5 | 5 | 138K | 0.16 | 1 min |
| 3. Plan (requirements review and plan, same agent) | `sdd-engineering:implementation-planner` | opus-5-5 | 7 | 289K | 0.56 | 2 min |
| 4a. Build group G1 (server check) | `sdd-engineering:implementer` | sonnet-5-5 | 6 | 134K | 0.11 | 22 s |
| 4b. Build group G2 (OpenAPI), parallel with G1 | `sdd-engineering:implementer` | sonnet-5-5 | 5 | 104K | 0.09 | 19 s |
| 4c. Build group G3 (tests) | `sdd-engineering:implementer` | sonnet-5-5 | 10 | 277K | 0.17 | 1 min |
| 5. Architecture review | `architecture-review:architecture-reviewer` | sonnet-5-5 | 5 | 76K | 0.07 | 14 s |
| 6. Review fix loop | not run (only one SUGGESTION, which the loop rules leave unfixed) | | | | | |
| 7a. Verify, round 1 (FAIL) | `sdd-engineering:implementation-verifier` | sonnet-5-5 | 6 | 135K | 0.13 | 25 s |
| 7b. Fix | `sdd-engineering:implementer` (fix mode) | sonnet-5-5 | 3 | 48K | 0.03 | 9 s |
| 7c. Verify, recheck (PASS) | `sdd-engineering:implementation-verifier` | sonnet-5-5 | 4 | 77K | 0.07 | 21 s |
| Orchestration | main session (the `run-plan` skill) | opus-5-5 | 41 | 2.3M (2.2M cache read) | 1.28 | 14 min (session span) |
| **Total** | 10 agents plus the main session | | **100** | **3.9M** | **3.15** | 8 min of agent time inside 14 min |

The subagents together are 1.6M tokens (41% of the run's tokens); the main session is the other 59% of tokens and 41% of
the estimated dollars. Do not confuse the two 41% figures.

Per role (retro): main $1.28, implementer (4 runs) $0.41, planner $0.56, spec-creator $0.47, verifier (2 runs) $0.20,
brainstorm $0.16, reviewer $0.07.

### Reported cost per CLI turn

The route ran as seven headless turns of one session (each user decision is one turn, because headless mode cannot ask
interactively and ends the turn with the questions as plain text). `total_cost_usd` is cumulative; the delta is the cost
of the turn.

| Turn | What happened | Cumulative $ | Turn $ | Wall time |
|---|---|---|---|---|
| 1 | Brief to the spec-creator, which returns 7 questions | 0.589 | 0.589 | 95 s |
| 2 | Answers; spec written (pass 2) | 0.849 | 0.260 | 85 s |
| 3 | Spec approved; brainstorm | 1.118 | 0.269 | 88 s |
| 4 | Option chosen; planner requirements review | 1.420 | 0.302 | 52 s |
| 5 | Execution mode chosen; plan written | 1.888 | 0.468 | 131 s |
| 6 | Plan approved; G1 and G2 built in parallel | 2.318 | 0.430 | 72 s |
| 7 | Checks re-run; G3, review, verify (FAIL), fix, recheck, closing report | 3.078 | 0.760 | 215 s |
| | **Route total** | **3.078** | **3.078** | **738 s (12.3 min)** |

### Trial total

| Item | $ |
|---|---|
| The route that produced the result (7 turns above) | 3.078 |
| First attempt, discarded (the plugin's reference files could not be read headless, see [Limitations](#limitations)) | 0.562 |
| Check that the plugins load (cheapest model) | 0.0035 |
| Probe that the write guards fire under `--plugin-dir` (cheapest model) | 0.182 |
| **Everything spent in the trial** | **3.826** (about $3.83) |

### Totals check

The figures were re-added from the source data:

- Turn deltas sum to 3.078, equal to the last cumulative value. Trial items sum to 3.826 (3.078 + 0.562 + 0.0035 + 0.182).
- Retro role rows sum to $3.15 and 100 requests; subagent tokens (564K + 289K + 289K + 212K + 138K + 76K) are 1.57M,
  matching the reported 1.6M; main 2.3M plus subagents 1.6M is the reported 3.9M.
- The ten stage rows above sum to $3.14, not $3.15, and the four implementer rows to $0.40, not the $0.41 of the role
  table: each row is rounded to the cent.
- The reported route cost ($3.078) and the estimate ($3.15) differ by $0.07 (2.3%). The estimate is the higher one; the
  difference was not investigated further.
- Orchestration share: 1.28 / 3.15 = 40.6%, rounded to 41%.
- Wall time has three values that are not interchangeable: 738 s is the shell clock summed over the 7 turns; the retro
  script reports 14 min as the span between the first and last request, which includes the pauses between turns; the
  CLI's own `duration_ms` values sum to about 477 s (for resumed turns it can cover only the last part of the turn).
  Agent time inside the run is 8 min. The "14 min" in the orchestration row is the session span, not busy time.

## Model per agent

| Agent | Model |
|---|---|
| main session (`run-plan`) | opus-5-5 |
| `spec-creator` | opus-5-5 |
| `implementation-planner` | opus-5-5 |
| `brainstorm`, `implementer`, `implementation-verifier`, `architecture-reviewer` | sonnet-5-5 |

These are the models the transcripts record. They match the `model:` field of each agent file (`opus` for the
spec-creator and the planner, `sonnet` for the others); the main session uses whatever model the user's session runs.

## What drove the cost

1. **Orchestration is the largest single item** ($1.28 of $3.15, 41 requests, 2.2M cache-read tokens). The main session
   ran across seven turns and launched 10 agents; each request re-reads the growing context. The agents do their
   work in files and return summaries, so this is mostly the cost of carrying the conversation, not of doing the work.
2. **The two agents on the larger model** (spec-creator and planner) cost $1.03 together, 33% of the estimate, with 15
   requests between them.
3. **Duplicate reads.** The server source file was read by 6 agents, the test file and the OpenAPI file by 5 each. The
   plan was read by 3 of 4 implementers and by both verifiers, and the spec by both verifiers, among their first six
   calls. Some agents read the same file twice (both parallel implementers read the plan twice; the planner read the test
   file twice, the brainstorm agent the OpenAPI file twice). The retro script flags all of this; the dollar value of
   removing it was not measured.
4. **A verifier FAIL caused by a contract defect.** Nobody in the route owned moving the spec to `implemented`: the
   implementer's text mentioned it, the step that does it did not, and the plan said no step edits the spec, while the
   plan check fails if the spec is not `implemented`. Round 1 of the verifier therefore failed on a correct build, which
   cost a fix-mode implementer and a recheck: about $0.10 (0.03 + 0.07), 30 s of agent time, plus the main session's turns
   around them.
5. **Over-asking.** For a change of about 40 lines the route asked 7 questions after the brief, 3 after the brainstorm and
   1 about the execution mode, each a separate headless turn with its own orchestration cost. Every question carried a
   recommended default; the trial still judged this too many for the size of the change.
6. **Stack mismatch.** The architecture reviewer preloaded two skills written for another stack (TypeScript onion
   architecture and React frontend architecture), then reported them as not applicable. The review cost $0.07 and returned
   one suggestion.

For contrast, the build itself (three implementer groups) was $0.37 and the review and verification (including the fix and recheck) together $0.30.

## Cost levers

| Lever | Expected effect | Status |
|---|---|---|
| Fix the contract defects found in the trial (who sets the spec to `implemented`; the `tests: on` wording for multi-agent plans) | Removes the guaranteed verifier FAIL round (about $0.10 here) and a contradiction between the docs and the behaviour | Shipping as `sdd-engineering` 1.1.1 (see its CHANGELOG for the exact list) |
| Stack-aware skill preloading (do not preload skills for another stack) | Less startup context for the reviewer and planner on non-TypeScript projects | Tried for the planner and `brainstorm` in the [repeated baseline](#repeated-baseline-and-one-optimization-2026-10-20): 4.5K tokens less in each starting context, about $0.06 per run expected, **not measurable against the run-to-run spread; not shipped**. The reviewer was not changed |
| Fewer questions for small changes | Fewer turns, so less orchestration cost | Tracked, **not done** |
| One agent reads a shared file and passes the needed lines on; preload the plan and spec for implementers and verifiers | Fewer duplicate reads | Raised as retro signals in this run, and again in all five runs of the repeated baseline (up to 12.7 KB of source read by three agents); not attempted, because the route hands over paths on purpose |
| Run a formatter in the verification step | No cost saving; a quality gap (the new server code was not formatted and no stage checks it) | Not stated as planned |
| Single-agent mode for small plans | Skips the reviewer and verifier stages (listed estimate for stage 5 and stages 7a to 7c: $0.30) | Available today; **not measured** (see below) |

The $0.30 in the last row is the sum of the stage estimates, an upper bound on what those stages cost in this run. It is
not a measured difference between two modes.

## Single-agent versus multi-agent

The planner asked for the execution mode and recommended single-agent for a three-file change. The trial deliberately
chose multi-agent against that recommendation, because its purpose was to exercise the whole route including the
reviewer and the verifier. So the numbers above describe the heavier mode.

**A single-agent run of the same task was not measured.** There is no figure in this document for what single-agent
would have cost, and none should be inferred. What can be said: multi-agent adds separate agents for the review and the
verification, and in this run it also produced the verifier FAIL round described above. Whether that extra work is worth
its cost depends on how much the user wants an independent check; for a change this small the planner advised against it.

## Repeated baseline and one optimization (2026-10-20)

The first baseline above is one full-route run. This section repeats a **short, fixed scenario** several times to see
how much a run varies, then tests **one** change against it. Result in one line: the run-to-run spread is about 6% of
the cost; the change removes about 4.5K tokens from the starting context of two agents, but the saving it can bring is
smaller than that spread, so the optimization is **inconclusive and was not shipped**.

### Scenario

- **Plugin and commit:** `sdd-engineering` 1.2.0, repository commit `29dbdbb` (tag `sdd-engineering--v1.2.0`), the
  four plugins loaded with `--plugin-dir` from a copy of `plugins/` per arm. Claude Code 2.1.305, headless.
- **Models:** not overridden. The main session, `spec-creator` and `implementation-planner` ran on opus-5-5,
  `brainstorm` on sonnet-5-5, in every run.
- **Project:** a throw-away clone of the Flutter/Dart sample app at commit `e150ea2`, reset to it before every run
  (`git clean -fdx && git checkout .`).
- **Brief (verbatim, the same in every run):** "Let the user filter the lineups list by grenade type (Smoke, Flash,
  Molotov, HE) with a chip row under the existing map chips, plus an All chip; the map and grenade type filters
  combine. Device only: no server or API change."
- **Command of turn 1:** `/sdd-engineering:run-plan --until plan --mode single "<brief>"`. The route is spec (two
  passes), approval, brainstorm, planner, and it stops at a plan that passes `check-plan.mjs`. Nothing is built,
  reviewed or verified, so these numbers are **not comparable** with the $3.08 full-route run above.
- **Turns:** driven with `--resume`, at most 10 per run. The next message is chosen from the files on disk, never from
  the wording of the model's answer.

### Fixed answer policy

Written down before the first run, identical for every run:

| Situation (read from `specs/` and `docs/plans/`) | Message sent |
|---|---|
| No spec yet (the agent asked questions) | "Answers: for every question choose the option marked (recommended); where none is marked choose option 1. Accept every default assumption. Nothing to add. Continue." |
| Spec is a `draft` and `check-spec.mjs` exits 0 | "Approved: `<spec path>` is approved. Set it to approved and proceed." |
| Brief with `Status: awaiting choice` | "For the brainstorm: choose the option marked (recommended) and accept the recommended answer to each of its questions. Continue." |
| Plan missing or failing, or the planner asks something | "Mode: single-agent. Otherwise answer every question with the option marked (recommended). Continue." |
| Plan exists, status `draft` or `approved`, `check-plan.mjs` exits 0 | stop |

The execution mode is also given on the command line (`--mode single`), so the planner normally does not ask. The plan
is never approved: the run ends at the plan check.

### Quality gate (the eval set)

One run passes when all six hold. `docs/cost-baseline/gate.mjs` computes them.

| # | Criterion |
|---|---|
| A1 | exactly one spec file in `specs/`, and `check-spec.mjs <spec>` exits 0 |
| A2 | exactly one plan file in `docs/plans/` (the brief `*.brainstorm.md` does not count), `check-plan.mjs <plan>` exits 0, and the plan `Status` is `draft` or `approved` |
| A3 | every `AC-n` of the spec appears on a `Covers:` line of the plan |
| A4 | `git status -uall` of the clone lists only paths under `specs/` and `docs/plans/` (nothing else written, no code) |
| A5 | no acceptance-criterion line of the spec holds implementation detail: a file name with an extension, a path starting `lib/`, `test/`, `server/` or `docs/`, a CamelCase, camelCase or snake_case identifier, or one of `setState`, `StatefulWidget`, `ChoiceChip`, `FilterChip`, `ListView`, `BuildContext`, `Widget` |
| A6 | the plan was reached within 10 turns, with no hook block (`spec-creator guard:`, `plans guard:` or `brainstorm guard:` in a tool result of any transcript) |

Critical errors counted besides the gate: hook blocks, a run that hit the turn cap, an agent that wrote code (also
covered by A4). The gate has no seeded defect, so it cannot show a **false negative** (a real problem that goes
unnoticed); that part of the lab's criterion is not measured here.

### Baseline: 3 runs on the unmodified plugin (and 2 control runs)

Cost is the CLI-reported `total_cost_usd` of the session. Latency is the shell clock summed over the turns. Counts come
from the transcripts (`retro.mjs`, subagents included); "tokens" includes cache reads, "API calls" are model requests.
"Cost (est.)" is the retro script's list-price estimate.

| Run | Cost $ (CLI) | Cost $ (est.) | Latency s | Tokens | Input | Output | Cache read | Cache write | API calls | Tool calls | Turns | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| base1 | 1.716 | 1.726 | 361 | 1,348,380 | 68 | 32,624 | 1,139,670 | 176,018 | 33 | 43 | 3 | pass |
| base2 | 1.670 | 1.683 | 376 | 1,638,705 | 82 | 31,445 | 1,450,684 | 156,494 | 40 | 49 | 4 | pass |
| base3 | 1.615 | 1.625 | 314 | 1,561,031 | 78 | 32,596 | 1,383,504 | 144,853 | 38 | 40 | 4 | pass |
| **median of 3** | **1.670** | 1.683 | **361** | 1,561,031 | 78 | 32,596 | 1,383,504 | 156,494 | 38 | 43 | 4 | 3/3 |
| range of 3 | 1.615-1.716 | 1.625-1.726 | 314-376 | 1.35M-1.64M | 68-82 | 31,445-32,624 | 1.14M-1.45M | 144,853-176,018 | 33-40 | 40-49 | 3-4 | |
| base4 (control) | 1.628 | 1.635 | 356 | 1,408,092 | 70 | 34,115 | 1,220,598 | 153,309 | 34 | 44 | 3 | pass |
| base5 (control) | 1.712 | 1.722 | 366 | 1,492,922 | 76 | 35,744 | 1,302,768 | 154,334 | 37 | 45 | 3 | pass |

base4 and base5 were run between the runs of the modified arm (order: base1-3, opt1, base4, opt2, base5, opt3), so the
comparison below also has baseline runs that are close in time to the modified ones. Over all five baseline runs: median
cost $1.670 and latency 361 s, range $1.615-1.716 and 314-376 s, standard deviation of the cost $0.046.

Pass rate 5/5. Critical errors: none (0 hook blocks, 0 runs over the turn cap, nothing written outside `specs/` and
`docs/plans/`). base2 had 2 denied tool calls (compound shell commands of the main session), which it retried.

### Where the cost goes (baseline evidence)

Per agent, median of the five baseline runs (the first-request context is a range over the five runs):

| Role | Model | First-request context (tokens) | Requests | Output tokens | Cost $ (est.) |
|---|---|---|---|---|---|
| main session | opus-5-5 | 25,124-26,957 | 16 | 5,555 | 0.534 |
| `spec-creator` | opus-5-5 | 26,283-26,332 | 8 | 13,155 | 0.560 |
| `brainstorm` | sonnet-5-5 | 18,053-18,094 | 5 | 5,511 | 0.155 |
| `implementation-planner` | opus-5-5 | 23,429-23,512 | 6 | 9,300 | 0.439 |

- **Output is 36% of the estimated cost** ($0.60 of $1.68 at list price; the rest, mostly cache writes, is what the
  models read). Output depends on how long a spec and a plan the model writes: the spec had 16 to 22 criteria in the
  five baseline runs. This is the largest source of run-to-run variance, and nothing tested in this section touches it.
- **A subagent pays for its starting context once, at the cache-write price.** Each subagent starts cold: its cache
  write is about as large as its peak context (brainstorm: 32-36K written, 32-36K peak). The price is $8 per million
  tokens for opus and $4 for sonnet (`prices.json`, 1-hour writes), then $0.2 per million for each later read.
- **What fills the starting context** (bytes of the plugin's files): `spec-creator.md` 15,703, plus the preloaded
  `spec-authoring/SKILL.md` 15,160 and `security/SKILL.md` 11,198. `implementation-planner.md` 23,418 and
  `brainstorm.md` 7,962, **each plus the preloaded `onion-architecture` (6,544) and `frontend-architecture` (6,742)**:
  13,286 bytes written for a TypeScript backend and a React/Next.js frontend. The main session reads `run-plan/SKILL.md`
  8,704, `feature-flow.md` 11,927 and `handoffs.md` 7,368.
- **The two architecture skills were never used on this project.** In the five baseline runs no `brainstorm` or
  `implementation-planner` called the Skill tool for them or read a file of theirs (0 of 5 runs). The sample is Dart.
  This is the stack-mismatch finding of the first baseline, now with a count.
- **Duplicate reads** (retro signal, in all five runs): 4 to 5 source files of the sample (up to 12.7 KB together,
  among them `lineup_list_screen.dart`, `lineup.dart`, `lineups_repository.dart`, `home_shell.dart`) were read by
  `spec-creator`, `brainstorm` and the planner, and the spec by the main session, `brainstorm` and the planner. Each
  agent needs a different slice, and the route hands over paths, not contents, on purpose (principle 1 of the route), so
  removing these reads would change a behaviour contract. Not attempted.
- **Literal duplication inside one agent's context is small.** Shared 8-word sequences: `spec-creator.md` against
  `spec-authoring/SKILL.md` 7% of the skill's words; the planner against the route documents 0 to 2%. The agent files
  repeat text from each other (planner and brainstorm 16%, planner and implementer 8%), but no agent holds two of
  them, so "remove duplicated instructions from the agent prompts" has little to remove in this scenario.

### The one change

Chosen because it is the largest block of unused starting context with a count behind it: **load the two
stack-specific architecture skills on demand instead of preloading them**, in `brainstorm` and `implementation-planner`.

- `agents/brainstorm.md` and `agents/implementation-planner.md`: the `skills:` frontmatter line is removed. The planner's
  Step 2 item 1 and the brainstorm's Step 2b now say which skill to load with the Skill tool for which stack
  (`onion-architecture` for a layered TypeScript/Node backend, `frontend-architecture` for a React/Next.js frontend,
  none for any other stack). "Or use the preloaded copy" is dropped from the planner's skill-choice step.
- `README.md` of the plugin: the table row that said the two agents preload the skills.
- 3 files, 4 lines added and 6 removed. No model, routing, `description`, hook or report format changed (the
  `description` fields end up in the main session's context and were left alone on purpose).
- Checks on the modified tree: `npm test` (284 tests) green, `node scripts/check-marketplace.mjs .` ok,
  `claude plugin validate .` passed.

### After: 3 runs on the modified plugin

| Run | Cost $ (CLI) | Cost $ (est.) | Latency s | Tokens | Input | Output | Cache read | Cache write | API calls | Tool calls | Turns | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opt1 | 1.943 | 1.951 | 356 | 1,693,980 | 84 | 38,431 | 1,475,236 | 180,229 | 41 | 49 | 3 | pass |
| opt2 | 1.658 | 1.666 | 305 | 1,519,505 | 76 | 32,589 | 1,334,695 | 152,145 | 37 | 48 | 3 | pass |
| opt3 | 1.689 | 1.697 | 336 | 1,443,426 | 72 | 37,028 | 1,255,438 | 150,888 | 35 | 45 | 4 | pass |
| **median of 3** | **1.689** | 1.697 | **336** | 1,519,505 | 76 | 37,028 | 1,334,695 | 152,145 | 37 | 48 | 3 | 3/3 |
| range of 3 | 1.658-1.943 | 1.666-1.951 | 305-356 | 1.44M-1.69M | 72-84 | 32,589-38,431 | 1.26M-1.48M | 150,888-180,229 | 35-41 | 45-49 | 3-4 | |

Pass rate 3/3, no critical errors, no hook block. In opt1 the planner loaded the `security` skill (a choice the planner
makes in its own step, unrelated to this change). No run loaded an architecture skill, as expected on a Dart project.

### Comparison and verdict

| Metric | Baseline, 3 runs: median (range) | Baseline, all 5: median (range) | Modified, 3 runs: median (range) | Gap vs the 5-run baseline | Gap larger than the baseline spread? |
|---|---|---|---|---|---|
| Cost $ (CLI) | 1.670 (1.615-1.716) | 1.670 (1.615-1.716) | 1.689 (1.658-1.943) | +0.019 (+1%) | no |
| Latency s | 361 (314-376) | 361 (314-376) | 336 (305-356) | -25 (-7%) | no (spread 62 s) |
| Tokens, total | 1,561,031 | 1,492,922 (1.35M-1.64M) | 1,519,505 (1.44M-1.69M) | +2% | no |
| Output tokens | 32,596 | 32,624 (31,445-35,744) | 37,028 (32,589-38,431) | +13% | the modified arm wrote more |
| Cache write | 156,494 | 154,334 (144,853-176,018) | 152,145 (150,888-180,229) | -1% | no |
| API calls / tool calls | 38 / 43 | 37 / 44 | 37 / 48 | | no |
| Pass rate | 3/3 | 5/5 | 3/3 | same | |

What the change did, measured directly and without noise: the first request of `implementation-planner` went from
23,429-23,512 to 18,905-18,979 tokens and that of `brainstorm` from 18,053-18,094 to 13,551-13,601, so **4.5K tokens
less in each**, in every run. At list prices (one write, then reads on the later requests) that is about $0.04 for the
planner and $0.02 for brainstorm: **about $0.06 per run, 3.7% of the median cost**. The two affected agents together
cost a median $0.594 before and $0.576 after (-$0.018). The expected effect is therefore smaller than the spread of the
baseline runs ($0.10, 6%, standard deviation $0.046) and well below what the length of the output alone moves (opt1
wrote longer specs and plans: 38.4K output tokens, $1.94).

Other views of the same data, none of which changes the reading: leaving out the first, cache-cold run of each arm (the
first run of an arm wrote 20-30K more cache tokens), the medians are $1.649 (4 baseline runs) against $1.674 (2 modified
runs); the cost without output tokens (post-hoc, list price) is $1.06 against $1.07.

**Verdict: inconclusive. Not kept.** The gate stayed green (8 of 8 runs) and there were no critical errors, but the
lab's condition "cost or latency really went down" is not met: the cost median is 1% higher, the latency median 7% lower,
and both gaps sit inside the spread of the baseline runs. A cost or latency saving cannot be claimed from this data, and
none is claimed. The plugin change was reverted: this branch has no plugin change and no version bump. Detecting a
$0.05 difference at a standard deviation of $0.046 would take roughly 13 runs per arm (about $22 per arm), by a normal
approximation.

What the numbers do support: the change removes real, unused context with no measurable quality cost on this project, so
it is harmless to ship later together with other changes, but it is **not worth a release on its own**. A larger saving
would have to come from elsewhere; the baseline points at output (36% of the cost) and at the main session (about a
third). Neither was tried.

### Limitations of this section

- **n = 3 per arm (5 for the baseline), one project, one brief, headless.** The standard deviation was estimated from
  5 runs.
- **The route varied inside the fixed policy.** The model sometimes ran the brainstorm and the plan in one turn (3
  turns) and sometimes stopped to ask which option to take (4 turns), and wrote specs of 16 to 22 criteria. Scripted
  answers remove the variance of the human, not of the model.
- **Cache warmth.** All eight runs fell inside one hour, the lifetime of the cache writes of the subagents (`1h` in the
  transcripts), so later runs may have read parts of the system prompt written by earlier ones. The first run of each arm
  wrote more cache tokens. Interleaving and the control runs reduce this confound but do not remove it.
- **Cost is reported by the CLI and estimated by list price; the two agree within 1%.** Neither is a bill.
- **The gate is mechanical.** A1-A6 do not judge whether a spec or a plan is good, and there is no seeded defect, so a
  "no new critical false negatives" check was not run. The plugin's own evals (`evals/`) were not run for the modified
  planner. A TypeScript project, where the planner would now spend one tool call loading a skill, was not tested.
- **Only spec, brainstorm and plan ran.** Build, review and verification were not part of this scenario. The
  architecture reviewer preloads the same two skills and is in another plugin; it was left unchanged.
- The user's global `CLAUDE.md` was not loaded (`--setting-sources project,local`, checked in a transcript) and the
  clone has none of its own, so the runs start from the same context in both arms.

## Limitations

- **One run, one project, one task.** Costs scale with the number of files, steps and questions; a different task can
  move every figure. This baseline has no variance estimate; the shorter scenario of the
  [repeated baseline](#repeated-baseline-and-one-optimization-2026-10-20) has one (standard deviation about 6% of the
  cost over 5 runs), and it does not cover the build, review and verify stages measured here.
- **Estimates, not billing data.** The per-agent dollars and the $3.15 total are token counts times list prices. The
  CLI's `total_cost_usd` is closer to what the run cost but is also the CLI's calculation, not an invoice. Neither
  accounts for any discount, plan or credit.
- **Headless mode distorts the run.** `claude -p` cannot ask questions interactively (the main session printed them and
  ended the turn, so the user decisions became separate resumed turns), background agents cannot show permission prompts
  (the two parallel implementers lost their first Bash call to a denial, skipped their checks, and the main session had
  to run them), and the plugin directories were loaded with `--plugin-dir` from outside the project, which made headless
  mode refuse to read the plugin's own reference files (the first attempt, $0.562, was discarded for that reason and
  re-run with an explicit read rule). A normal install and an interactive session will differ, probably in the number of
  turns and permission events, in directions not measured here.
- **Allowlist side effects.** Several agent commands (compound shell commands, heredocs) were denied by the trial's
  allowlist and retried, which adds a little to the counts.
- **Parts of the route were not exercised.** The architecture review fix loop did not run, the `engineering-insights`
  skill was not invoked by any agent (no finding passed its filter), the retro ledger was not written, and none of the
  plugin's `userConfig` options were set.
- **The transcript format is internal to Claude Code and undocumented**, and the retro script says so; it may stop
  working on a future version. This run used Claude Code 2.1.304.
- **Prices change.** `prices.json` is dated 2026-09-24.

## How to re-measure

Placeholders: `<MARKETPLACE_CHECKOUT>` is a clone of this repository, `<SAMPLE_APP>` is the project to run the route in
(a git checkout on a throw-away branch with a clean tree), `<SESSION_ID>` is the `session_id` printed by the first turn.
Node 16 or newer is needed for the script.

Turn 1 starts the route; every later turn resumes the same session with the user's answer or approval. Keep one output
file per turn, so the per-turn cost can be read afterwards.

```sh
PLUGINS=<MARKETPLACE_CHECKOUT>/plugins

run_turn() {   # usage: run_turn LABEL "PROMPT" [SESSION_ID]
  ( cd <SAMPLE_APP> && claude -p "$2" --output-format json --max-budget-usd 12 \
      --permission-mode acceptEdits --setting-sources project,local \
      --plugin-dir "$PLUGINS/engineering-paved-path" --plugin-dir "$PLUGINS/research-tools" \
      --plugin-dir "$PLUGINS/architecture-review"    --plugin-dir "$PLUGINS/sdd-engineering" \
      --allowedTools "Bash(dart:*)" "Bash(flutter:*)" "Bash(git status:*)" "Bash(git diff:*)" "Bash(git log:*)" \
                     "Bash(node:*)" "Bash(ls:*)" "Bash(grep:*)" "Bash(cat:*)" "Bash(sed:*)" "Bash(head:*)" \
                     "Read(/$PLUGINS/**)" "Glob(/$PLUGINS/**)" "Grep(/$PLUGINS/**)" \
      --disallowedTools WebFetch WebSearch \
      ${3:+--resume "$3"} < /dev/null > "<OUT_DIR>/$1.json" )
}
# the Read/Glob/Grep rules are needed because the plugins are outside the project; without them
# headless mode refuses to read the plugin's reference files
```

The command list above is a shortened version of the allowlist used in the trial (which also allowed more read-only
`git`, `find`, `wc`, `echo`, `awk`, `diff`, `sort`, `tr`, `cut`, `cd` and `rg`). Add the check commands of your project.

Run the turns:

```sh
run_turn 01 "/sdd-engineering:run-plan <the brief>"
run_turn 02 "<answers to the questions>"          <SESSION_ID>
run_turn 03 "Approved: <spec path> is approved, proceed."  <SESSION_ID>
# ... one turn per question or approval, until the closing report
```

Read the reported cost of every turn (the value is cumulative for the session; subtract the previous one):

```sh
node -p "const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); [d.session_id, d.total_cost_usd, d.num_turns].join(' ')" <OUT_DIR>/01.json
```

Measure the finished run from the transcripts (read-only; the transcripts are read from `$CLAUDE_CONFIG_DIR/projects`, or
`~/.claude/projects`, in the folder named after the project directory):

```sh
node <MARKETPLACE_CHECKOUT>/plugins/sdd-engineering/skills/workflow-retro/assets/retro.mjs \
  --cwd <SAMPLE_APP> --session <SESSION_ID>            # Markdown: totals, by role, by agent, signals
# add --json for data, --since / --until <ISO> to narrow a session that holds other work,
# --write --label <name> to also add a row to the retro ledger
```

When `/sdd-engineering:workflow-retro` is available in a normal session, it runs the same script and then writes the
actions; the commands above are the headless equivalent. The script exits with 2 when it finds no usage (format not
recognised), in which case report that instead of numbers. Costs that are not part of the route (a discarded attempt, a
smoke check) are not in the session's `total_cost_usd`; add them separately, as in the [trial total](#trial-total).

To compare a single-agent run, repeat the whole procedure on the same brief and the same starting commit, answer the
execution-mode question with single-agent, and compare the route totals. One pair of runs is still one sample each.

### Repeat the fixed scenario and compare two plugin trees

Scripts in `docs/cost-baseline/` (Node 20 or newer, `claude` on the PATH, no dependencies). They reproduce the
[repeated baseline](#repeated-baseline-and-one-optimization-2026-10-20): `drive.mjs` runs the scenario and the answer
policy, `collect.mjs` measures a finished run and computes the gate A1-A6 (`gate.mjs`), `stats.mjs` prints medians and
ranges. The brief, the policy, the turn cap (10) and the allowed tools are constants at the top of `drive.mjs`; the
allowed tools list `dart` and `flutter`, so change it for another sample app. `<WORK>` is an **absolute** path to an
empty folder; the sample must be a throw-away clone, because `drive.mjs` runs `git clean -fdx && git checkout .` in it
before every run. One run costs about $1.7 with the default models; each turn is capped at $5 and each run at $6.

```sh
export WORK=<WORK>                      # absolute path
R=<MARKETPLACE_CHECKOUT>/docs/cost-baseline
git clone --branch main <SAMPLE_APP_REPO> "$WORK/sample"
mkdir -p "$WORK/arms/base" "$WORK/arms/opt" "$WORK/runs"
cp -R <CHECKOUT_AT_THE_BASE_COMMIT>/plugins  "$WORK/arms/base/plugins"   # the unmodified plugins
cp -R <CHECKOUT_WITH_THE_CHANGE>/plugins     "$WORK/arms/opt/plugins"    # the plugins with one change

# interleave the arms; run collect right after each run, before the next one resets the clone
for run in base:1 opt:1 base:2 opt:2 base:3 opt:3; do
  arm=${run%%:*}; n=${run##*:}
  node "$R/drive.mjs" "$arm" "$n" && node "$R/collect.mjs" "$arm" "$n"
done
(cd "$WORK" && node "$R/stats.mjs" base:1,2,3 opt:1,2,3)    # Markdown tables: medians, ranges, per role
```

`drive.mjs` writes `runs/<arm><n>/NN.json` (one file per turn, with the reported cost) and `result.json`; `collect.mjs`
adds `retro.json`, `retro.md` and `summary.json` (cost, tokens, calls, per-agent figures, hook blocks, the gate).
Run the arms close in time and interleaved: all runs share the prompt cache for an hour, so a modified arm that runs
last has a warmer cache than a baseline that ran first. Compare the gap of the medians with the range of the baseline
runs, not with zero; with a spread of about 6% a saving smaller than that needs far more than three runs to show.
