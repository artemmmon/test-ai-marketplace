# sdd-engineering

Spec Driven Development for Claude Code: a feature goes from a text requirement (or a Figma design) to a written
specification, a comparison of ways to build it, an implementation plan, the code, an architecture review and an
independent verification, with five specialised agents and one entry command, `/sdd-engineering:run-plan`. **The
spec says what, the plan says how**: every acceptance criterion has an id, every plan step cites the ids it
covers, and the verifier traces the finished code back to each id, so nothing is built that nobody asked for and
nothing that was asked for is forgotten. Two decisions stay with you: you approve the spec and you approve the plan.

It is for developers and small teams who want AI-written features to be reviewable and repeatable: a person reads
two short documents instead of a diff full of surprises. It works on any codebase; it does not assume a language,
a framework or a folder layout.

## Contents

1. [What you get](#what-you-get)
2. [Dependencies](#dependencies)
3. [Install and update](#install-and-update)
4. [The route of run-plan](#the-route-of-run-plan)
5. [Quick start](#quick-start)
6. [Inputs and configuration](#inputs-and-configuration)
7. [Guards and checks (hooks) and what to read before installing](#guards-and-checks-hooks)
8. [Keeping token cost down](#keeping-token-cost-down)
9. [The retro: workflow-retro](#the-retro-workflow-retro)
10. [Insights files: engineering-insights](#insights-files-engineering-insights)
11. [Spec lifecycle](#spec-lifecycle)
12. [What is intentionally not included](#what-is-intentionally-not-included)

## What you get

### Agents (5)

All are addressed by scoped name, for example `sdd-engineering:spec-creator`.

| Agent | Role | Model | May write | May not |
|---|---|---|---|---|
| `sdd-engineering:spec-creator` | Pass 1: reads your sources, finds design gaps and edge cases, and returns a discovery report of questions and proposals. Pass 2: writes one spec | opus | Only `<specs_dir>/*.md`, only while the spec is `Status: draft` (a hook enforces it) | Approve a spec, write plans or code, run a shell, use the web, start any agent except `research-tools:researcher`, call any MCP tool except Figma read tools (`get_*`) |
| `sdd-engineering:brainstorm` | Compares 3-5 materially different ways to build the feature in a weighted matrix with a sensitivity check (or a short brief when only one way is viable) and recommends one | sonnet | Only its own brief, `<plans_dir>/NN-short-name.brainstorm.md`, as `Status: awaiting choice` (a hook enforces it) | Edit anything else, write steps or code, start agents |
| `sdd-engineering:implementation-planner` | Reviews the requirements (questions, recommendations, execution mode), then writes a Development Plan whose every step names files, rules with `path:line`, the spec ids it covers and a checkable "Done when" | opus | Only its own plan, `<plans_dir>/NN-short-name.md`, only while it is `Status: draft` (a hook enforces it) | Write or edit a spec, approve a plan, write code, review architecture or security, start agents, use the web |
| `sdd-engineering:implementer` | Executes one step group of an approved plan (or, in fix mode, a list of gaps), repairs the tests its change breaks, runs the checks and compares its own diff with the plan | sonnet | Project code, and the `Status:` lines of the plan and the spec it implements | Start agents, use the web, review architecture or security, write new tests unless asked (`tests: on`, either mode), commit, push or open pull requests |
| `sdd-engineering:implementation-verifier` | The last gate: read-only trace of the finished code to every spec id and every plan step, one verdict per item, `PASS`, `FAIL` or `INCOMPLETE` overall; `recheck:` after a fix | sonnet | Nothing | Write or edit files, start agents, use the web, judge whether the plan was the right one |

Limits expressed as "may not" for `Bash` (read-only git and search commands for the read-only agents) are
instructions in the agent prompts. What the plugin enforces technically are the `tools` lists of the agents and the
hooks described below.

### Skills (4)

| Skill | Called by | What it does |
|---|---|---|
| `run-plan` | You: `/sdd-engineering:run-plan` | The entry point. Takes a spec, a plan, designs and a requirements text in any combination, finds out which stage the feature is in and drives it along the route below. Claude never starts it on its own |
| `workflow-retro` | You: `/sdd-engineering:workflow-retro` | Measures a finished run from the Claude Code transcripts on disk, proposes three to five concrete actions and appends a row to the retro ledger. Claude never starts it on its own |
| `spec-authoring` | The agents `spec-creator` (preloaded), `implementation-planner` and `implementation-verifier` (read by path); also loaded by Claude when you write or review a spec | The spec template, EARS acceptance criteria, the `US/AC/EC/NFR/OQ` ids, provenance tags for inputs, untrusted inputs and the spec lifecycle; ships `check-spec.mjs`, a runnable spec form check |
| `engineering-insights` | The agent `implementer` (loads it when it has a finding to record); also loaded by Claude on its own, or by you, when a session hits a dead end, a quirk or an error and its fix | Appends non-obvious findings to the nearest `INSIGHTS.md` of the module you are working in: fixed sections, dated entries with a `Where: path:line` anchor, append-only. Creates the file when it does not exist yet; ships `assets/INSIGHTS.template.md` |

## Dependencies

```
sdd-engineering
 |-- engineering-paved-path    rulebook skills
 |-- research-tools            researcher agent
 `-- architecture-review       architecture-reviewer agent
        `-- engineering-paved-path
```

Each is declared in `plugin.json` with the range `^1.0.0`. Claude Code installs dependencies automatically,
including the indirect one, so one install command is enough.

| Plugin | Why `sdd-engineering` needs it |
|---|---|
| [`engineering-paved-path`](../engineering-paved-path/README.md) | Its skills are the rulebook of the agents: `spec-creator` preloads `engineering-paved-path:security` to find untrusted inputs; `brainstorm` and `implementation-planner` preload `engineering-paved-path:onion-architecture` and `engineering-paved-path:frontend-architecture` and put the practices of the stack skills into plan steps |
| [`research-tools`](../research-tools/README.md) | `spec-creator` hands questions that reading cannot settle to `research-tools:researcher`: up to four in parallel, one question each, repository or web |
| [`architecture-review`](../architecture-review/README.md) | The review loop runs `architecture-review:architecture-reviewer` after the build and again after each fix |

A `^1.0.0` range follows minor and patch releases of the dependencies; a new major release of a dependency needs a
new release of `sdd-engineering`.

## Install and update

```sh
claude plugin marketplace add artemmmon/test-ai-marketplace
claude plugin install sdd-engineering@test-ai-marketplace
```

The three dependencies are installed with it. Claude Code asks for the plugin's options when you enable it; the
defaults are fine to start with (see [Inputs and configuration](#inputs-and-configuration)).

Update by hand, because auto-update is off for third-party marketplaces:

```
/plugin marketplace update test-ai-marketplace
/reload-plugins
```

If a plugin still looks stale: `claude plugin uninstall sdd-engineering`, then `claude plugin install
sdd-engineering@test-ai-marketplace` again.

## The route of run-plan

```
 request text / Figma / design files / existing spec or plan
                      |
                      v
 1  spec-creator        pass 1: discovery report -> you answer the questions -> pass 2: draft spec
    (up to 4 research-tools:researcher in parallel while it reads)
                      |
        APPROVAL 1 -- you set the spec to "Status: approved"
                      |
                      v
 2  brainstorm         brief with 3-5 scored options -> you pick one
                      |
                      v
 3  implementation-planner   requirements review (questions, recommendations, mode)
                      |       -> draft plan -> check-plan.mjs must be clean
        APPROVAL 2 -- you approve the plan ("Status: approved")
                      |
                      v
 4  implementer        one run per step group; groups in disjoint packages may run in parallel
                      |
                      v
 5  architecture-review:architecture-reviewer      reads the diff, returns JSON findings
                      |
                      v
 6  review loop        CRITICAL / WARNING on changed lines + failed checks
                      |   -> ONE implementer in fix mode -> reviewer "recheck:" -> repeat
                      |   at most 3 rounds, then stop and ask you
                      v
 7  implementation-verifier      traceability matrix: PASS | FAIL | INCOMPLETE
                      |   FAIL -> implementer fix mode -> verifier "recheck:"
                      |   at most 2 rounds, then stop and ask you
                      v
    closing report (spec id, plan path, verdict, findings not fixed, what was not run)
```

How it behaves:

- **Start from the latest approved artifact.** What you pass decides the entry stage. A spec in `draft` goes back to
  you for review, an approved spec starts at brainstorm, a chosen brief starts at the planner, an approved plan goes
  to the build, an implemented plan goes to the review loop or the verifier. A missing approval is never skipped,
  also not with `--from`.
- **Two approvals are yours.** A spec and a plan both start as `Status: draft`. Only you approve them; the main
  session writes `approved` on your explicit yes for that file. `brainstorm` and the planner stop on a draft spec,
  `implementer` stops on a draft plan, and `check-plan.mjs` fails a plan whose spec is not approved or that leaves
  an `AC-n`, `EC-n` or `NFR-n` without a step.
- **The spec says what, the plan says how.** The spec holds problem, user stories, EARS acceptance criteria, edge
  cases, inputs and untrusted inputs, with no implementation details. The plan is the only handoff to the
  implementer: it carries the files, the rules and the done condition for each step, so the implementer needs
  nothing from the planning conversation.
- **Bounded fix loops.** The architecture review loop runs at most 3 rounds, the verifier's fix loop at most 2.
  After the limit the run stops, shows what is left and asks you: change the plan, amend the spec, or accept.
  SUGGESTIONs and findings outside the changed code are never fixed in the loop; they go into the closing report.
- **Single-agent versus multi-agent.** The planner asks you every time, unless you pass `--mode multi` or
  `--mode single`.
  - `multi-agent`: the steps are split into step groups (about 3-5 steps or 15 files each), each group runs in a
    fresh `implementer`; the whole route above runs, including review and verification. It fits a change across
    several packages or layers, or more than about 5 steps or 15 files.
  - `single-agent`: one `implementer` does every step in one group `G1`, with no handoffs. Stages 5-7 are skipped
    and the closing report says so (you can ask for the verifier on the plan afterwards). It fits a small change in
    one package.
- **Amending an approved spec.** If planning or building finds a gap (a missing criterion, an undecided edge case),
  you decide it, `spec-creator` reopens the spec as a draft under an `Amended:` line, adds the new requirement under
  the next free id, and you approve again. Existing ids are never renumbered.
- **Where the run ends.** After the verifier, with a closing report. Writing new tests (only when you ask for them, see below), a correctness review, a
  security review, documentation, committing, pushing and opening a pull request are outside the plugin: `run-plan`
  does none of them and tells you so in the report.

### Flags of `run-plan`

| Argument | Effect |
|---|---|
| a path to `<specs_dir>/NN-*.md` | The spec. Used at every stage |
| a path to `<plans_dir>/NN-*.md` | The plan; its `Spec:` line names the spec. Starts the execution |
| a path to `<plans_dir>/NN-*.brainstorm.md` | The brief; goes to the planner |
| a Figma URL, an image, a PDF or a design path | A design source for `spec-creator` |
| any other text | The requirements |
| `--only spec` or `--only plan` | Run one agent alone and stop (`spec-creator`, or `implementation-planner` without a brainstorm) |
| `--mode multi` or `--mode single` | Choose the execution mode so the planner does not ask |
| `--from <stage>`, `--until <stage>` | Stage names: `spec`, `brainstorm`, `plan`, `build`, `review`, `verify`. `--from` never skips an approval |

## Quick start

### 1. From a text requirement

```
/sdd-engineering:run-plan "Users can save a filter on the order list and re-apply it with one click"
```

What happens: `spec-creator` reads the code around the order list (and starts researchers if it needs facts it
cannot read), then returns a **Spec discovery report** with design gaps, uncovered edge cases, proposals and
numbered questions. `run-plan` relays the questions to you; you answer. The spec is written to
`specs/NN-saved-filters.md` as `Status: draft`. You read it, change what you want, and tell Claude it is approved.
The run then continues with brainstorm, the plan (the planner asks you for the execution mode if you did not pass
one), your plan approval, the build, the review loop and the verifier. After the plan is approved you are offered a
choice: continue in this session, or stop and run `/sdd-engineering:run-plan docs/plans/NN-saved-filters.md` in a
fresh session, which is cheaper after a long planning conversation.

With designs, pass them in the same command:

```
/sdd-engineering:run-plan "Order list filters" https://www.figma.com/design/<file> designs/orders/
```

### 2. From an approved spec or plan

```
/sdd-engineering:run-plan specs/12-saved-filters.md --mode multi
```

The spec is approved and there is no brief, so the run starts at brainstorm and goes on from there.

```
/sdd-engineering:run-plan docs/plans/12-saved-filters.md
```

The plan is approved, so the run does the pre-flight (notes the current git status and the base commit, which commands
will check the code, whether the services those checks need are running) and then builds. For a plan that is `in progress` the run picks up at the
first group with no report.

To stop after one artifact:

```
/sdd-engineering:run-plan --only spec "Order list filters" designs/orders/
/sdd-engineering:run-plan --only plan specs/12-saved-filters.md
```

### Calling one agent by its scoped name

Plugin agents are namespaced. Ask for them by the scoped name in a prompt, or start them through the Agent tool with
`subagent_type` set to the scoped name; a bare name such as `implementer` is not found.

```
Use the sdd-engineering:implementation-verifier agent on docs/plans/12-saved-filters.md. specs_dir: specs
```

```
Use the sdd-engineering:spec-creator agent. amend: specs/12-saved-filters.md. Gap: nothing says what happens when
a saved filter refers to a deleted column. Decision: the filter is shown as unavailable.
```

Prompts to agents carry paths and a few `key: value` lines (`specs_dir:`, `plans_dir:`, `checks:`, `mode:`,
`group:`, `recheck:`), never file contents. Values in the prompt override the plugin options.

## Inputs and configuration

The plugin declares five options (`userConfig`). None is required.

| Key | Type | Default | Used for |
|---|---|---|---|
| `specs_dir` | directory | `specs` | Where specs are written and read. Relative to the repository root |
| `plans_dir` | directory | `docs/plans` | Where briefs and plans are written. Relative to the repository root |
| `retro_ledger` | file | `docs/retros/ledger.md` | The file `workflow-retro` appends one row per measured run to; each full report is written beside it |
| `check_commands` | list of strings | empty | Commands `implementer` and `implementation-verifier` run to check the code (type check, tests, lint), one per entry. Empty: they use the **Verification** section of the plan, and if that names none either, they report "checks not run: no commands configured" |
| `architecture_checks` | list of strings | empty | Commands the architecture reviewer may run as mechanical checks (an architecture linter, a boundary check). Empty: none are run |

**Where to change them.** Claude Code asks for the options when you enable the plugin. Afterwards run
`claude plugin configure sdd-engineering` to see which are set and which are not (it can also save values from
standard input with `--values-stdin`). For one run, put the value
in the prompt instead: `specs_dir: docs/specs`, `plans_dir: docs/plans`, `checks:` followed by a list of commands.
Precedence: your words, then the plugin option, then the built-in default.

Known limitations:

- **Defaults apply when nothing is saved.** Claude Code does not apply the `default` of an option that was never
  saved: the placeholder `${user_config.KEY}` stays in the text and no `CLAUDE_PLUGIN_OPTION_<KEY>` variable is
  exported. Every agent and script therefore carries the same built-in default (`specs`, `docs/plans`,
  `docs/retros/ledger.md`, no commands) and treats an empty or placeholder value as unset. The practical effect: the
  defaults above always hold, and a folder you want to change must be saved (or passed in the prompt) to take effect.
- **List options are comma-joined.** `check_commands` and `architecture_checks` reach the agents as one string with
  the entries joined by commas, so a single command that contains a comma is split in two. Keep each command free
  of commas (put the logic into a script or a package script, for example `npm run check`), or pass the command in
  the prompt with `checks:`.

Other notes: `run-plan` passes the resolved `specs_dir:` and `plans_dir:` to every agent so a run does not depend on
what each agent can read; the architecture reviewer receives `architecture_checks` as its `checks:` list. If a
folder in a project is shared by several people, commit the specs and plans: they are the record of what was decided.

## Guards and checks (hooks)

Plugin agents cannot declare hooks in their frontmatter, so `hooks/hooks.json` registers the guards for the whole
session. Each script reads the hook payload and acts **only** when `agent_type` is its own agent; for every other
caller, including your main session, it exits at once and does nothing. Every hook has a 10 second timeout.

| Hook | When | For which agent | Effect |
|---|---|---|---|
| `scripts/spec-creator-guard.mjs` | Before `Write`, `Edit`, `Agent`, `Task` and MCP tools | `sdd-engineering:spec-creator` | Write and edit only `<specs_dir>/*.md`, only while the spec is `Status: draft` before and after the change; the one exception is an amendment, an `approved` spec whose first edit turns it back into `draft`; start only `research-tools:researcher`; MCP calls only to Figma read tools (`get_*`) |
| `scripts/plans-guard.mjs --kind plan` | Before `Write` and `Edit` | `sdd-engineering:implementation-planner` | Write only `<plans_dir>/NN-short-name.md`, never a `.brainstorm.md`, only while `Status: draft` |
| `scripts/plans-guard.mjs --kind brainstorm` | Before `Write` and `Edit` | `sdd-engineering:brainstorm` | Write only `<plans_dir>/NN-short-name.brainstorm.md`, only as `Status: awaiting choice` |
| `scripts/run-check-hook.mjs ... check-spec.mjs --hook` | After `Write` and `Edit` | `sdd-engineering:spec-creator` | Runs the spec form check and returns its errors (`path:line: error: ...`) to the agent, which must fix them |
| `scripts/run-check-hook.mjs ... check-plan.mjs --hook` | After `Write` and `Edit` | `sdd-engineering:implementation-planner` | Runs the plan check (markers, steps, files, spec-id coverage) and returns its errors to the agent |

A blocked call exits with code 2 and the reason goes back to the agent. Nothing here touches the network.

### What to read before installing

The plugin runs Node scripts on your machine. Read these first:

| File | Why |
|---|---|
| `hooks/hooks.json` | The complete list of what runs and when |
| `scripts/guard-lib.mjs`, `scripts/spec-creator-guard.mjs`, `scripts/plans-guard.mjs` | The guards: they read the hook payload and project files and write nothing |
| `scripts/run-check-hook.mjs` | Runs a check script only for the right agent |

The skills also ship scripts that agents or you run explicitly: `skills/spec-authoring/assets/check-spec.mjs` (reads
specs), `skills/run-plan/assets/check-plan.mjs` (reads plans and specs, and runs read-only `git` commands) and
`skills/workflow-retro/assets/retro.mjs` (reads your Claude Code transcripts under `~/.claude/projects`, or
`$CLAUDE_CONFIG_DIR/projects`, and writes only the report and the ledger). All scripts are plain Node ESM without
dependencies and need Node 16 or newer. Their tests sit beside them (`*.test.mjs`) and run with `node <file>`.

## Keeping token cost down

Every tool call re-reads the agent's whole context, so cost grows with context length times the number of calls,
far more than with the model. The route is built around that:

- **Pass paths, not content.** Prompts carry the plan path, the group and the handoff, never plan text or a diff.
  The planner and `brainstorm` write their own files and return a ten-line summary, so a plan never sits in the main
  session's context.
- **One implementer run per step group.** Groups run in order, each in a fresh `implementer` that gets the previous
  group's handoff. A finished implementer is never resumed for the next group.
- **A small start for every agent.** The implementer reads only the plan up to the `implementer-brief:end` marker,
  the spec lines it needs by id, and only the matching parts of long notes.
- **Bounded loops.** Three review rounds, two verifier rounds, then the run stops and asks you.
- **No test-writing stage; tests only on request.** By default the implementer only repairs the tests its change
  breaks, and the verifier checks each criterion by reading the code (and by existing tests that name the id).
  When you ask for tests, `run-plan` passes `tests: on` to every implementer and to the verifier, in `multi-agent`
  and `single-agent` runs alike; the implementer of a step's group writes that step's `Tests (new)` and names each
  test with its spec id.
- **Narrow checks.** A group that is not the last runs only the cheap checks; the full set runs once at the end.
- **Fresh session after a break.** The main session's cache expires after about an hour; after planning, or a long
  break, start the execution from the handoff note instead of resuming a large context.
- **One researcher per module.** A question that spans several modules is split, and at most four researchers run in
  a pass.

## The retro: workflow-retro

```
/sdd-engineering:workflow-retro --plan docs/plans/12-saved-filters.md --label saved-filters
```

After a run has finished, the skill reads the transcripts of the sessions on disk, including the transcripts of
nested subagents (a parent's usage does not contain its children's), and measures: tokens, cache reads and writes,
tool calls, duration, parallelism (peak agents at once, agent time against wall time), per role and per agent, with
how large each context grew. It flags signals (`duplicate-context`, `preload`, `overloaded-role`, `concurrency`,
`cold-cache`), turns the heaviest into three to five concrete actions ("agent X: drop the read of Y, 7 of 8 runs
read it"), and with `--write` creates `<date>-<label>.md` beside the ledger and appends one row to the ledger
(`docs/retros/ledger.md` by default, the `retro_ledger` option or `--ledger <file>`). Dollar figures are list-price
estimates from `assets/prices.json`, output tokens are partly estimated, and quality is not measured. It does not
change the agents; applying an action is a separate change. Options: `--session <id>`, `--since`, `--until`,
`--shallow` (main session only), `--ledger`.

## Insights files: engineering-insights

Lessons a session learns the hard way (a library quirk, a dead end, an error and its fix, an unwritten convention)
are lost when the session ends. The `engineering-insights` skill keeps them in an `INSIGHTS.md` next to the code:

- **Where.** The nearest module or package folder to the finding (most specific wins); the repository root file is
  for findings that span modules. The file is optional and is created on the first finding worth keeping, from
  `skills/engineering-insights/assets/INSIGHTS.template.md`.
- **What goes in.** Only non-obvious findings, one `### YYYY-MM-DD — title` entry of 1-4 lines under one of seven
  fixed sections, closing with `Where: path:line`. Unchecked claims are marked `(unverified)`.
- **Append-only.** Entries are never edited or deleted; a finding proven wrong gets a new `Supersedes "<title>"`
  entry, so the history of what was believed stays readable.
- **Who reads and writes.** `spec-creator`, `brainstorm` and `implementation-planner` read the files that exist
  (and the planner lists new findings under "Insights to record"); `implementer` writes them by following the
  skill. The spec-creator and planner guards still allow writes only to their own files, so those agents never
  edit an insights file.
- **Without the files.** Nothing requires them: when a project has none, every agent skips the read.

## Spec lifecycle

A spec is a Markdown file `<specs_dir>/NN-feature-name.md` with a header (`Spec ID: SPEC-NN`, `Status`,
`Supersedes`, `Packages`, `Sources`) and ten sections: problem and user, goals and non-goals, user stories, workflow
and module interactions, acceptance criteria, edge cases, non-functional requirements, inputs and provenance,
untrusted inputs, open questions.

| Id | Where | Shape |
|---|---|---|
| `US-n` | User stories | As a role, I want a capability, so that a benefit |
| `AC-n` | Acceptance criteria | One EARS pattern, one `shall`, an observable response: `WHEN <trigger>, the <system> shall <response>.` (also `WHILE`, `IF ... THEN`, `WHERE`) |
| `EC-n` | Edge cases | A decided situation and its behaviour, ending with the `AC` that covers it |
| `NFR-n` | Non-functional requirements | A measurable requirement: performance, cost, accessibility, security |
| `OQ-n` | Open questions | A question with the default assumption. A question that blocks a criterion keeps the spec a draft |

```
draft  ->  approved  ->  implemented
```

The author (`spec-creator`) writes `draft`; only you set `approved`; the `implementer` of the plan's last group sets
`implemented` in the same pass as the plan's own status (the spec stays `approved` if the plan ends `partial`). To change an approved spec, amend it (back to `draft`, `Amended:` line, new ids,
approve again). To change an implemented spec, write a new one with `Supersedes:`. A brief goes `awaiting choice` ->
`chosen: option <k>`; a plan goes `draft` -> `approved` -> `in progress` -> `implemented` or `partial`.

## What is intentionally not included

| Not here | What to do instead |
|---|---|
| A test-writing stage | There is none. By default the route repairs broken tests only; ask for tests in your request and each implementer writes the tests of its own steps (`tests: on`), in either mode |
| A correctness review, a security review, a documentation stage, a pull-request self-review | Run them with your own tools or skills. `engineering-paved-path:security` is a rulebook you can apply by hand |
| Committing, pushing, opening or merging pull requests | `run-plan` never does these |
| A fixed mapping from file paths to skills and checks | The planner chooses skills from their descriptions and from your `CLAUDE.md` / `AGENTS.md` when they exist, and records the choice in each step |
| Default check commands | Configure `check_commands` (or write a Verification section in the plan); the plugin does not guess your tooling |

## Requirements

Claude Code 2.1.269 or newer, Node 16 or newer for the scripts, and git. The project does not need any particular
language or framework; Figma read access is used only if you pass Figma links and a Figma MCP server is available.

## License

MIT.

## Links

- [CHANGELOG.md](CHANGELOG.md)
- [COMPATIBILITY.md](COMPATIBILITY.md)
