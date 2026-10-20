> Demo fixture: this plugin is fictitious and exists only to show the catalog design.

# engineering-paved-path

Team engineering conventions packaged for Claude Code: React best practices, a code review checklist, commit conventions and guard hooks.

## What's inside

| Component | Type | Purpose |
|---|---|---|
| `react-best-practices` | skill | React and TypeScript conventions |
| `code-review` | skill | Review checklist for pull requests |
| `commit-conventions` | skill | Conventional Commits |
| `code-reviewer` | agent | Reviews a diff against the conventions |
| `/review-pr` | command | Reviews the current pull request |
| `hooks` | hooks | Blocks edits to generated files, runs the formatter |

## Security

The plugin ships **hooks** that run shell scripts on `PreToolUse` and `PostToolUse`. Read `hooks/hooks.json` before installing.
