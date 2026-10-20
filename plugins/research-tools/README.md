# research-tools

A read-only research agent for Claude Code. Give it one concrete question and it answers from your repository,
from external sources (official docs, changelogs, issues, articles) or from both, and hands back a short report in
which every claim is backed by a `path:line` quote or a URL it actually opened, and everything it could not find is
listed under **Not found**. It cannot edit files, so you can point it at any codebase without risk to your working
tree.

## What you get

| Component | Name | Model | Tools |
|---|---|---|---|
| Agent | `research-tools:researcher` | sonnet | Read, Grep, Glob, Bash, WebSearch, WebFetch, AskUserQuestion, Skill |

`Write`, `Edit` and `NotebookEdit` are disallowed. The agent is told to use `Bash` only for read-only commands
(`git log`, `git show`, `git diff`, `git blame`, `git ls-files`, `ls`, `cat`, `sed -n`, `rg`, `grep`). That limit on
`Bash` is an instruction in the agent prompt, not a technical sandbox. The plugin has no skills, hooks, scripts or
settings.

## Install

```sh
claude plugin marketplace add artemmmon/test-ai-marketplace
claude plugin install research-tools@test-ai-marketplace
```

The plugin has no dependencies, so nothing else is installed. To update later, see the root README of the
marketplace (`/plugin marketplace update test-ai-marketplace`, then `/reload-plugins`).

## How to use it

Ask Claude to use the agent by its scoped name, `research-tools:researcher`, or let Claude pick it when you ask a
research question. Other agents start it through the Agent tool with `subagent_type: research-tools:researcher`.

A repository question:

```
Use the research-tools:researcher agent: where is the retry policy for outbound HTTP defined, and what are its
limits? Done when I know the file, the numbers, and who calls it.
```

An external question:

```
Use the research-tools:researcher agent: does the version of the ORM in package.json still recommend
connection pooling through the driver, or has the guidance changed? Done when you can cite the docs page for
that version.
```

Both at once (the agent does the repository part first, because it tells it which version to check online):

```
Use the research-tools:researcher agent: are we using our HTTP client library the way its docs recommend for
timeouts? Done when I have a list of the differences with file:line on our side.
```

To save tokens when you already looked at something, end the prompt with `Already read: <paths>`. The agent then
searches around those files instead of opening them again.

### What a good prompt contains

| Part | Example |
|---|---|
| A specific question, not a topic | "how is the session token refreshed", not "look at auth" |
| A subject | a module, file, feature, library or API |
| A done condition | "done when I know which function decides it" |

If any of the three is missing the agent does not search. It asks one to three short questions with options. When
it runs as a subagent, where `AskUserQuestion` is filtered out, it returns a **Clarification report** instead and
the calling session relays the questions.

## What it returns

One Markdown report, in one of three formats. Empty sections say "None.".

| Report | Sections |
|---|---|
| Repository report | Question, Answer (one to three sentences), Findings (each marked fact or inference, with confidence and a `path:line` quote), Code map, Not found, Open questions |
| External report | Question, Answer, Findings (each with a source label: official, maintainer or community, and a date or version), Conflicts, Sources (with dates), Not found, Open questions |
| Clarification report | The request as understood, questions with options, the default assumption |

Rules the agent follows: it reports only what it opened or fetched in that run; it prefers primary sources and
checks that a source covers the version your project uses; it quotes at most 15 words from a web page; when sources
disagree it records the conflict and says which is more authoritative; it never prints secret values from `.env*`
files; it stops after about 15 searches or fetches per mode and lists whatever is unanswered under Not found.

## Inputs and configuration

There is nothing to configure. The only inputs are in the prompt: the question, an optional `Already read:` line,
and, if you want, the mode (repository, external or both). If a `CLAUDE.md`, `AGENTS.md` or `INSIGHTS.md` exists the
agent reads it for orientation; it works the same without them.

## Dependencies

None, and no skills. Several plugins in this marketplace build on it: the `spec-creator` agent of
`sdd-engineering` starts up to four researchers in parallel, one question each, while it writes a spec.

## What it deliberately does not do

- It does not edit, create, move or delete anything, and it does not run the code under investigation.
- It answers one question per run. A prompt that covers several unrelated subjects is better split into several
  runs, which can go in parallel and cost far less than one run that re-reads a large context.
- It does not start other agents and does not run deep multi-source research products; it uses its own tools.
- It does not guess. When evidence is missing the answer is "Not found", together with what it tried.

## Requirements

Claude Code 2.1.269 or newer. A git repository is needed only for repository questions; outside one, the agent
says so and treats the question as external.

## License

MIT. The agent is original work.

## Links

- [CHANGELOG.md](CHANGELOG.md)
- [COMPATIBILITY.md](COMPATIBILITY.md)
