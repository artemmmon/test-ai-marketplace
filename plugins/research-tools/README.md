# research-tools

A read-only research agent for Claude Code.

## What it provides

| Component | Name | Model | Tools |
|---|---|---|---|
| Agent | `research-tools:researcher` | sonnet | Read, Grep, Glob, Bash, WebSearch, WebFetch, AskUserQuestion, Skill |

`Write`, `Edit` and `NotebookEdit` are disallowed, and the agent is told to use `Bash` only for read-only
commands (`git log`, `git show`, `git diff`, `git blame`, `git ls-files`, `ls`, `cat`, `sed -n`, `rg`, `grep`).
The restriction on `Bash` is an instruction in the agent prompt, not a technical sandbox.

The agent answers **one** concrete question, from the repository, from external sources (official docs,
changelogs, issues, articles), or from both, and reports only what it opened or fetched in that run.

## Input contract

Send a prompt that contains:

- a specific question (not just a topic),
- a subject: a module, file, feature, library or API,
- a done condition: how you will know the question is answered.

Optional: end the prompt with `Already read: <paths>` and the agent will search around those files instead of
re-reading them. If the question is vague, the agent asks 1-3 short clarifying questions (or, when it runs as a
subagent where `AskUserQuestion` is filtered out, returns a Clarification report and stops).

If they exist, the agent reads `CLAUDE.md`, `AGENTS.md` and `INSIGHTS.md` for orientation; it works without them.

## Output

One Markdown report, in one of three formats:

- **Repository report**: Question, Answer, Findings (fact or inference, confidence, `path:line` evidence), Code map, Not found, Open questions.
- **External report**: Question, Answer, Findings, Conflicts, Sources (with dates and versions), Not found, Open questions.
- **Clarification report**: questions with options and a default assumption.

## Use

```
Use the research-tools:researcher agent: where is the retry policy for outbound HTTP defined, and what are
its limits? Done when I know the file, the numbers, and who calls it.
```

Other agents and skills should refer to it by its scoped name, `research-tools:researcher`. Up to a few
researchers can run in parallel on independent questions.

## Install

```sh
claude plugin marketplace add artemmmon/test-ai-marketplace
claude plugin install research-tools@test-ai-marketplace
```

## Dependencies and version

No dependencies, no skills. Current version: 1.0.0. See [CHANGELOG.md](CHANGELOG.md) and
[COMPATIBILITY.md](COMPATIBILITY.md).

## Sources

The agent is original work, extracted from the DevDigest project and generalized (no project-specific paths). Plugin license: MIT.
