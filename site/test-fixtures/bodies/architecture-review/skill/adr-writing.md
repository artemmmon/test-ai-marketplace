# ADR writing

Use when a significant technical decision is made or is about to be made.

## Template

Copy `templates/adr.md` and fill in:

- **Context**: the forces at play, in plain language.
- **Options**: at least two, each with pros and cons.
- **Decision**: the chosen option and why.
- **Consequences**: what becomes easier, what becomes harder.

## Rules

- One decision per ADR.
- Number ADRs sequentially: `0007-use-postgres-for-events.md`.
- Never edit an accepted ADR; supersede it with a new one.
