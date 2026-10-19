> Demo fixture: this plugin is fictitious and exists only to show the catalog design.

# architecture-review

Architecture review workflow for Claude Code: write ADRs, compare options and get a second opinion from a reviewer agent.

## What's inside

- `adr-writing` skill: Architecture Decision Records with context, options and consequences.
- `architecture-review` skill: a structured review of quality attributes, risks and recommendations.
- `architecture-reviewer` agent: reviews a proposed design and points out missing ADRs.

## Requirements

Depends on [`engineering-paved-path`](https://github.com/artemmmon/test-ai-marketplace) `^1.0.0` for the code review conventions. Claude Code installs it automatically.

## Usage

```text
Ask Claude: "Review the architecture of the payments service and draft ADRs for open decisions."
```
