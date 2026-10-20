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
| Stack-aware skill preloading (do not preload skills for another stack) | Less startup context for the reviewer and planner on non-TypeScript projects | Tracked, **not done** |
| Fewer questions for small changes | Fewer turns, so less orchestration cost | Tracked, **not done** |
| One agent reads a shared file and passes the needed lines on; preload the plan and spec for implementers and verifiers | Fewer duplicate reads | Raised as retro signals in this run; not stated as planned |
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

## Limitations

- **One run, one project, one task.** Costs scale with the number of files, steps and questions; a different task can
  move every figure. There is no variance estimate.
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
