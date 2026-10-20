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

| Location | Case | What it checks |
|---|---|---|
| research-tools | `vague-request-asks-first` | "research the auth" comes back as clarifying questions, not research |
| research-tools | `repo-question-with-evidence` | a concrete question gets the right answer with `path:line` evidence and fact/inference labels |
| research-tools | `absent-subject-reports-not-found` | an e-mail module that does not exist is reported under "Not found", with no invented provider |
| engineering-paved-path | `security-ssrf-import-url` | bare `fetch(body.url)` is CRITICAL SSRF; reuse the project's guarded client |
| engineering-paved-path | `security-llm-output-html` | raw HTML enabled on LLM output is CRITICAL stored XSS |
| engineering-paved-path | `onion-new-endpoint` | a new endpoint is split into port, repository, service, thin route and composition root |
| engineering-paved-path | `fastify-route-schema` | plugin, JSON Schema in and out, framework 404, `inject()` test |
| architecture-review | `reviewer-layer-violations` | a framework import in the domain and `new Repository()` in a service, both found and rated |
| architecture-review | `reviewer-placement-warning` | inline calculation is a WARNING with the placement rule; style is not reported |
| architecture-review | `reviewer-clean-diff` | a conforming diff gets no CRITICAL finding and no invented ones |
| architecture-review | `reviewer-missing-target` | `mode: module` without a target returns the clarification JSON |
| sdd-engineering | `spec-ears-from-vague-brief` | a vague brief becomes EARS criteria with ids, traceability and open questions instead of invented numbers |
| sdd-engineering | `spec-creator-discovery-pass` | pass 1 returns questions with numbered options and writes no spec file |
| sdd-engineering | `run-plan-draft-spec-gate` | `/sdd-engineering:run-plan` on a draft spec stops, asks for approval and surfaces the open questions |
| sdd-engineering | `workflow-retro-keep-concurrency` | with no API errors the retro keeps concurrency and proposes preloading the repeated read |

Cases that run an agent grade the agent's reply and also check with a `tool_used` grader that the right
agent or skill was called. In a with/without comparison those checks fail without the plugin by design;
that is the plugin's contribution (`Δ`).

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
```

Notes:

- `--scaffold` runs the `fixture.sh` of each selected case as you. The scripts only write small text
  files into the empty run workspace; read them before running.
- Without it the cases that need a fixture fail, because the project they ask about is not there. The
  other cases do not need it.
- A case runs 3 times by default and passes at score 1.0 (`--threshold`). The initial gate is that every
  case passes. For a quick smoke test use `--runs 1 --ablation none` (one run, no no-plugin baseline).
- Run a single case with `--case <name>`, for example
  `claude plugin eval . --case reviewer-missing-target --runs 1 --ablation none`.
- `--max-cost-usd <usd>` sets a hard ceiling; a one-run smoke test of a case costs a few cents.
- No case is granted `Bash`, `Write` or `Edit`. Diffs and code samples are inlined in the prompts or built
  by `fixture.sh`.
