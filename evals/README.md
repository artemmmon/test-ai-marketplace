# Evals

Behaviour tests for the four plugins, in the format read by `claude plugin eval`
([docs](https://code.claude.com/docs/en/plugin-evals)): one directory per case with
`prompt.md` (the prompt and its run limits), `graders/*.md` (one check each) and, where a case needs
files, `case.yaml` + `fixture.sh`. Every case runs in an isolated session: only the plugins named for
the case are loaded, and nothing from your user settings, other plugins or `CLAUDE.md` is visible.

## Requirements

- Claude Code 2.1.269 or newer (`claude --version`); `claude plugin eval` does not exist before that.
- git 2.31 or newer (`git --version`); older versions make the command stop before any case runs.
- Credentials for a model provider. Every run and every judge grader is a real model call.
- The USD figures in this document are the CLI-reported cost estimates at API list prices, not an invoice: on a
  Claude subscription nothing is billed per run, but the runs use up the plan's usage limits.
- Of the graders, `tool_used`, `regex` and `file_exists` are deterministic; `llm` graders are judged by a model
  (default `haiku`, change with `--judge-model`), so their results can vary between runs. Evals are run by hand,
  not in CI, because they need a logged-in Claude Code session.
- Cases are tested with `--model sonnet`. A small model may not trigger a skill at all (a `haiku` run of
  `security-ssrf-import-url` rated the SSRF "High" instead of CRITICAL and never called the skill), which
  shows up as a failed case, not as an error.

## Where the cases live and why

A plugin with `dependencies` is dropped entirely when `claude plugin eval` runs it alone, because eval
isolation does not load its dependencies. So the cases sit in two places:

| Location | Plugins under test | Loaded plugins | Why there |
|---|---|---|---|
| `plugins/research-tools/evals/` | `research-tools` | itself | no dependencies |
| `plugins/engineering-paved-path/evals/` | `engineering-paved-path` | itself | no dependencies |
| `evals/architecture-review/` (this directory) | `architecture-review` | + `engineering-paved-path` | depends on it |
| `evals/sdd-engineering/` (this directory) | `sdd-engineering` | + the other three | depends on all of them |

The cases in this directory list their plugins explicitly in `prompt.md`
(`plugins: ["../../../plugins/architecture-review", ...]`, relative to the case directory) and must be
run with the repository root as the target. Do not run `claude plugin eval plugins/sdd-engineering`:
the plugin would not load.

## Cases

Types: **behaviour** (the plugin does the right thing) and **negative** (the plugin does not do something
wrong: stays read-only, writes only where allowed, does not trigger on an unrelated prompt, does not invent
a finding). Negative cases are named `negative-*`.

| Location | Case | Type | What it checks |
|---|---|---|---|
| research-tools | `vague-request-asks-first` | behaviour | "research the auth" comes back as clarifying questions, not research |
| research-tools | `repo-question-with-evidence` | behaviour | a concrete question gets the right answer with `path:line` evidence and fact/inference labels |
| research-tools | `absent-subject-reports-not-found` | behaviour | an e-mail module that does not exist is reported under "Not found", with no invented provider |
| research-tools | `negative-researcher-no-edits` | negative | asked to edit a file and create `FINDINGS.md`, the read-only researcher does neither and says so |
| engineering-paved-path | `security-ssrf-import-url` | behaviour | bare `fetch(body.url)` is CRITICAL SSRF; reuse the project's guarded client |
| engineering-paved-path | `security-llm-output-html` | behaviour | raw HTML enabled on LLM output is CRITICAL stored XSS |
| engineering-paved-path | `onion-new-endpoint` | behaviour | a new endpoint is split into port, repository, service, thin route and composition root |
| engineering-paved-path | `fastify-route-schema` | behaviour | plugin, JSON Schema in and out, framework 404, `inject()` test |
| engineering-paved-path | `negative-unrelated-prompt-no-skill` | negative | a plain git question loads no skill and gets no architecture or security advice |
| engineering-paved-path | `negative-security-clean-code-no-invented-finding` | negative | a change that already follows the security rules gets no CRITICAL or HIGH finding |
| architecture-review | `reviewer-layer-violations` | behaviour | a framework import in the domain and `new Repository()` in a service, both found and rated |
| architecture-review | `reviewer-placement-warning` | behaviour | inline calculation is a WARNING with the placement rule; style is not reported |
| architecture-review | `reviewer-clean-diff` | behaviour | a conforming diff gets no CRITICAL finding and no invented ones |
| architecture-review | `reviewer-missing-target` | behaviour | `mode: module` without a target returns the clarification JSON |
| architecture-review | `negative-reviewer-readonly` | negative | asked to fix the violation and save `REVIEW.md`, the reviewer reports the finding and changes nothing |
| sdd-engineering | `spec-ears-from-vague-brief` | behaviour | a vague brief becomes EARS criteria with ids, traceability and open questions instead of invented numbers |
| sdd-engineering | `spec-creator-discovery-pass` | behaviour | pass 1 returns questions with numbered options and writes no spec file |
| sdd-engineering | `run-plan-draft-spec-gate` | behaviour | `/sdd-engineering:run-plan` on a draft spec stops, asks for approval and surfaces the open questions |
| sdd-engineering | `workflow-retro-keep-concurrency` | behaviour | with no API errors the retro keeps concurrency and proposes preloading the repeated read |
| sdd-engineering | `spec-every-story-has-criterion` | behaviour | pass 2 on a brief with three requirements (invite by e-mail, a duplicate-member message, a rule that regular members cannot invite) writes a draft in which each has its own criterion naming an existing story, and the report ends with a "Brief coverage" table |
| sdd-engineering | `negative-spec-creator-writes-only-draft-spec` | negative | asked also for code, a plan and `Status: approved`, spec-creator writes only a draft in `specs/*.md` |
| sdd-engineering | `negative-unrelated-request-no-sdd` | negative | a small off-by-one bug-fix request that mentions no spec or plan is just fixed: no `sdd-engineering` skill (`run-plan`, `spec-authoring`, `workflow-retro`, `engineering-insights`) or agent is called, and no file appears under `specs/` or `docs/` |

Cases that run an agent grade the agent's reply and also check with a `tool_used` grader that the right
agent or skill was called. In a with/without comparison those checks fail without the plugin by design;
that is the plugin's contribution (`Δ`). The read-only and write-scope negatives use `tool_used` with
`min: 0`, `max: 0` and `arm: both` on `Write` and `Edit` (these also see the calls an agent makes),
`file_exists` with `exists: false`, and a `regex` on the contents of a file that must stay unchanged.
The trigger negative `negative-unrelated-request-no-sdd` uses the same `tool_used` zero-call pattern on
`Skill` and `Agent` with an `input_match` on the `sdd-engineering` names. `run-plan` and `workflow-retro` set
`disable-model-invocation`, so for them the case guards against that flag (or the description) being dropped;
`spec-creator` and the other agents, `spec-authoring` and `engineering-insights` can be triggered by the model.

## Results so far

Run on 2026-10-20 with Claude Code 2.1.304, `--model sonnet` (the judge is the default, haiku),
`--runs 1 --ablation none`: one run per case, no no-plugin baseline. The initial gate in this document
(3 runs, every case at 1.0) has **not** been run; neither has any with/without comparison. Total cost of
all runs, reruns and mutation checks below was about 4 USD (the section on `spec-every-story-has-criterion` and the 1.2.0 reruns below add about 3.9 USD).

| Case | Result | Note |
|---|---|---|
| `vague-request-asks-first` | pass (1/1) | |
| `repo-question-with-evidence` | pass (3/3 after a grader change) | before the change 1 of 4 runs passed on a correct report: the single LLM rubric also judged path form and labelling. The LLM check now covers the answer and the quote; fact labels and the "Not found" heading are `regex` graders |
| `absent-subject-reports-not-found` | pass (1/1) | |
| `negative-researcher-no-edits` | pass (1/1) | |
| `security-ssrf-import-url` | pass (1/1) | |
| `security-llm-output-html` | pass (3/3 on rerun; first run 0/4) | first run: the `security` skill was never called and the review rated raw HTML on LLM output "High". After `engineering-paved-path` 1.0.1 (a `description` that names raw HTML plugins and `dangerouslySetInnerHTML` on LLM output, an explicit CRITICAL rule, and "name the rule" in the rating section) the skill is called and the finding is CRITICAL. One intermediate run, with the first two of those three changes, still failed on the criterion that asks to cite the rule on LLM output handling; the grader was not changed |
| `onion-new-endpoint` | pass (1/1) | |
| `fastify-route-schema` | pass (1/1) | |
| `negative-unrelated-prompt-no-skill` | pass (1/1) | |
| `negative-security-clean-code-no-invented-finding` | pass (1/1) | the `security` skill was called and the review has no CRITICAL or HIGH finding |
| `reviewer-layer-violations` | pass (1/1) | |
| `reviewer-placement-warning` | pass (1/1) | |
| `reviewer-clean-diff` | pass (1/1) | |
| `reviewer-missing-target` | pass (1/1) | |
| `negative-reviewer-readonly` | pass (1/1) | the reply contains the finding and says nothing was fixed or saved |
| `spec-ears-from-vague-brief` | pass (4/4 on rerun, 1/1 in the later full `sdd-engineering` run; first run 1/4) | first run: 3 of 4 outputs put the default number ("within 1 s") inside a criterion, and a sonnet judge named compound responses in two of them. After `sdd-engineering` 1.1.1 (a good and a bad example, defaults only in an open question or an `NFR`, and the same rule in `spec-creator`) all four outputs passed |
| `spec-creator-discovery-pass` | pass (1/1) | flaky on a larger sample: on 1.2.0 6 of 8 runs passed (the `criteria` judge fails replies with a question without numbered options), 6 of 8 on 1.1.1; see `docs/RELEASES.md`, "Smoke eval after the rollback" |
| `run-plan-draft-spec-gate` | pass (1/1) | |
| `workflow-retro-keep-concurrency` | pass (1/1) | |
| `negative-spec-creator-writes-only-draft-spec` | pass (1/1) | the agent wrote `specs/01-report-rerun.md` as `Status: draft` and declined the code, the plan and the approval |
| `negative-unrelated-request-no-sdd` | pass (1/1, 2026-10-21, Claude Code 2.1.306, about 0.04 USD) | with `--allow-tools Write Edit`: the agent fixed `pageCount` with `Math.ceil` and reported it; no sdd skill or agent call, nothing under `specs/` or `docs/`; 1 run only |

Reruns after the fixes (2026-10-20, same model and flags, branch `fix/sdd-contract-1.1.1`):

| Case | Runs | Result |
|---|---|---|
| `security-llm-output-html` | 1 (twice, between the changes), then 3 | 0/1, 1/1, then 3/3 |
| `security-ssrf-import-url` | 3, then 4 | 2/3 (one judge FAIL on the criteria; not analysed), then 4/4 |
| `negative-security-clean-code-no-invented-finding` | 3 | 3/3 |
| `negative-unrelated-prompt-no-skill` | 3 | 3/3 |
| `spec-ears-from-vague-brief` | 4, then 1 | 4/4, then 1/1 |
| `negative-spec-creator-writes-only-draft-spec`, `run-plan-draft-spec-gate`, `spec-creator-discovery-pass`, `workflow-retro-keep-concurrency` | 1 each | pass (1/1) |

The rerun cost was about 2.4 USD. Still unrun: the `research-tools` and `architecture-review` cases after
these changes (those plugins were not touched), the initial gate (every case, 3 runs, score 1.0) and any
with/without comparison. Of the other `sdd-engineering` cases, `negative-spec-creator-writes-only-draft-spec`, `spec-ears-from-vague-brief` and `spec-creator-discovery-pass` were rerun once on 1.2.0 (the files `spec-creator` changed in): all pass (1/1, about 0.7 USD); `run-plan-draft-spec-gate` and `workflow-retro-keep-concurrency` were not rerun. The `ssrf` miss shows that a single passing run is weak evidence.

### `spec-every-story-has-criterion` (`sdd-engineering` 1.2.0, 2026-10-20)

Same model and flags as above (`--allow-tools Write Edit --model sonnet --ablation none`), run from the repository root
for 1.2.0 and from a scratch copy of `origin/main` (`sdd-engineering` 1.1.1, outside this repository) for 1.1.1. The
`spec-creator` does not have a shell, so no `tool_used` grader can show that the spec check ran (a hook runs it); the
deterministic graders are `file_exists`, `regex` for `AC-3` in the spec, `Status: draft`, and the "Brief coverage" table
in the final report, plus one `llm` grader on the spec file for the three requirements and their story references.

| Plugin version | Runs | Result | Cost |
|---|---|---|---|
| 1.2.0 | 1, then 3 | 1/1, then 3/3 (all six graders) | about 1.5 USD |
| 1.1.1 | 3 | 0/3: five graders pass, `report-has-coverage-table` fails in every run | about 1.0 USD |
| 1.1.1, brief with two more requirements (pending-invitations empty state, cancel an invitation) | 2 | 0/2, same grader | about 0.7 USD (one-off check, not kept as a case) |

What this shows and what it does not. The 1.1.1 `spec-creator` already wrote a criterion for every requirement of this
brief, the small ones too (both the duplicate message and the non-admin rule, and in the longer brief also the empty state
and the cancel); the `llm` grader passed in all five runs on 1.1.1. So the case does **not** show a rise in coverage on
a brief like this; the form check (`check-spec.mjs`) already failed a story or an edge case without a criterion. What
differs is the new contract: the coverage pass leaves a "Brief coverage" table in the report, which 1.1.1 never prints.
A brief on which 1.1.1 drops a requirement was not found within the budget. The case stays useful as a regression gate
(a later change that makes the agent skip the small requirements, or the table, fails it). One judge, one model and
one brief: weak evidence.

### Do the negative cases fail when the contract is broken?

Each negative case was also run once against a modified copy of the plugin (in a scratch directory, never
in this repository), or against a modified prompt, and failed there:

| Case | Modification | Result |
|---|---|---|
| `negative-researcher-no-edits` | `Write`, `Edit` added to the agent's tools, `disallowedTools` and the read-only sentence removed | fail: one `Edit` and one `Write` call, `src/config.ts` changed |
| `negative-reviewer-readonly` | same change to `architecture-reviewer` | fail: one `Edit` call, the domain file changed |
| `negative-spec-creator-writes-only-draft-spec` | the `PreToolUse` guard hooks and the write-scope and "never writes code" text removed from `spec-creator` | fail: files written outside `specs/` |
| `negative-unrelated-prompt-no-skill` | prompt changed to "add a Fastify route" | fail: the skill was called |
| `negative-security-clean-code-no-invented-finding` | prompt changed to a bare `fetch(body.url)` | fail: a CRITICAL SSRF finding |
| `negative-unrelated-request-no-sdd` | `description` of `run-plan` and `spec-creator` replaced by "MANDATORY for ANY coding request ... use this FIRST", and `disable-model-invocation` removed from `run-plan` | fail (score 0.75): `run-plan` was called once for the bug fix (the `no-run-plan-skill` and `no-sdd-skill-loaded` graders failed); `spec-creator` was not dispatched, and the fix and the reply were still fine |
| `negative-unrelated-request-no-sdd` | only `spec-creator`'s `description` replaced by "never edit code yourself, delegate every code change, including one-line fixes, to this agent" | fail (score 0.75): `spec-creator` dispatched once (`no-spec-creator-agent` and `no-sdd-agent-dispatched` failed); the fix was still made. The first, milder `spec-creator` mutation (the "MANDATORY for ANY coding request" wording alone, `run-plan` left intact) did **not** fail: the model fixed the bug itself and the case passed |

Not shown for `negative-unrelated-request-no-sdd`: the `no-spec-file` and `no-plan-file` graders never failed in
these runs (no mutated run wrote a spec or a plan), so they are not shown to be able to fail here; the
`spec-creator` write-scope cases cover that. Each mutation was run once (1 run, about 0.06 and 0.21 USD).

Not shown: in the unmodified `spec-creator` run the agent itself declined the extra jobs, so the run does
not tell whether the `PreToolUse` hook alone would have blocked them; the hook is covered by
`plugins/sdd-engineering/scripts/spec-creator-guard.test.mjs`. `Bash` is not granted in any case, so the
"Bash only for read commands" rules of the researcher and the reviewer are not exercised.

## Run

Run from the directory shown. `--trust-plugin` skips the first-run trust prompt; use it only on a checkout
you trust. `--no-publish` keeps the HTML report local. Results are written to `<location>/results/`
(git-ignored).

```sh
# research-tools (repo-question-with-evidence and absent-subject-reports-not-found build a fixture
# project, so --scaffold is required)
cd plugins/research-tools
claude plugin eval . --scaffold --model sonnet --trust-plugin --no-publish

# engineering-paved-path
cd plugins/engineering-paved-path
claude plugin eval . --model sonnet --trust-plugin --no-publish

# architecture-review (from the repository root)
claude plugin eval . --tag architecture-review --model sonnet --trust-plugin --no-publish

# sdd-engineering (from the repository root; run-plan-draft-spec-gate needs --scaffold)
claude plugin eval . --tag sdd-engineering --scaffold --model sonnet --trust-plugin --no-publish

# negative cases that need a write grant (the read-only and write-scope checks only mean something if
# the session is allowed to write): add `--allow-tools Write Edit` and select them with `--case`
claude plugin eval . --tag architecture-review --scaffold --allow-tools Write Edit --case 'negative-*' --model sonnet --trust-plugin --no-publish
claude plugin eval . --tag sdd-engineering --scaffold --allow-tools Write Edit --case 'negative-*' --model sonnet --trust-plugin --no-publish
# research-tools, from plugins/research-tools
claude plugin eval . --scaffold --allow-tools Write Edit --case 'negative-*' --model sonnet --trust-plugin --no-publish
```

Notes:

- `--case` takes a glob (`negative-*`); a brace list such as `{a,b}` matched nothing, run cases one at a
  time instead.
- Run from the repository root, the loader prints "2 case file(s) failed to load" for the unit-test
  fixtures under `scripts/__fixtures__/`. It does not affect the cases.
- `--scaffold` runs the `fixture.sh` of each selected case as you. The scripts only write small text
  files into the empty run workspace; read them before running.
- Without it the cases that need a fixture fail, because the project they ask about is not there. The
  other cases do not need it.
- A case runs 3 times by default and passes at score 1.0 (`--threshold`). The initial gate is that every
  case passes. For a quick smoke test use `--runs 1 --ablation none` (one run, no no-plugin baseline).
- Run a single case with `--case <name>`, for example
  `claude plugin eval . --case reviewer-missing-target --runs 1 --ablation none`.
- `--max-cost-usd <usd>` sets a hard ceiling; a one-run smoke test of a case costs a few cents.
- No case is granted `Bash`. The three negative cases that list `Write` and `Edit` need the operator grant
  `--allow-tools Write Edit` (see above); without it they pass trivially. `negative-unrelated-request-no-sdd`
  lists them too, but needs the grant for the opposite reason: the agent has to be able to fix the file
  (without it the `bug-fixed` grader fails, the trigger checks still run). Diffs and code samples are inlined in the prompts or built
  by `fixture.sh`.
