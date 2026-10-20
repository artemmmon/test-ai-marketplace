---
name: spec-authoring
description: Rules for writing, reviewing and reading a feature specification in Spec Driven Development - the spec template and its ten sections, user stories, EARS acceptance criteria, edge cases, non-functional requirements, inputs with provenance tags, untrusted inputs, open questions, the US/AC/EC/NFR/OQ ids that plans and verification trace to, the draft -> approved -> implemented lifecycle, and a runnable spec check. Use whenever creating or editing a file in the project's specs folder, turning a brief, a Figma frame or a design file into requirements, wording or reviewing an acceptance criterion, looking for gaps in a design, or tracing a plan step or a test back to a requirement - even if the word "spec" is never used. Not for implementation plans (implementation-planner), comparing ways to build something (brainstorm), or documenting a feature that already exists.
---

# Spec authoring

Decisions about **what a spec says and how each requirement is worded**. Rules come from the
sources in [README.md](README.md); `[S1]` marks source #1 there.

## Where a spec lives

Project settings come from the prompt first (a line such as `specs_dir: docs/specs`), then from the
plugin option `${user_config.specs_dir}`, then from the built-in default `specs`. An option value
that is empty, or that still begins with a dollar sign and an opening brace, means no value was
saved: use the default. Paths are relative to the repository root. Call the folder `<specs_dir>`.

- **Place.** The spec is a file directly in `<specs_dir>/`, no subfolders. If `<specs_dir>/README.md`
  exists it is the index: add the spec's line in the format it already uses.
- **Number.** `NN` is one sequence: the highest of the `<specs_dir>/NN-*.md` numbers and every
  `Spec ID: SPEC-NN` in the folder, plus one. The header carries it as `Spec ID: SPEC-NN`.
- **Name.** After the feature, the name a user would call it ("Smart Diff", "Run Cost Badge"), not a
  task or a ticket ("Add column"). Title `# Spec: <feature name>`; file `NN-<feature-name>.md`, the
  same name in kebab-case, shortened only by dropping filler words, e.g. `10-smart-diff.md`.
- **Language.** The spec's prose follows the project's documentation; the EARS keywords stay in capitals.
- **Legacy specs** (no `Spec ID:` line, another template) are not converted and not checked. To change
  what one says, write a new spec with `Supersedes:`.

## The one rule

**A spec says what the product must do and how to tell that it does — never how it is built.**
Every requirement is observable from outside the module, checkable by a test or an inspection, and
traceable to a source. If a sentence would still be true after the code was rewritten in another
way, it belongs in the spec; if not, it belongs in the plan.

## Principles

1. **Every requirement has a source.** It comes from the user, from a source the user gave, or
   from the current code. Your own ideas are proposals and enter the spec only after the user
   accepts them. *Why:* the next agents read only the spec; an invented requirement becomes code
   nobody asked for.
2. **One EARS pattern, one `shall`, one response per criterion.** Clauses in the fixed order
   WHERE → WHILE → WHEN or IF … THEN → `the <system> shall <response>`. *Why:* a fixed shape
   removes the ambiguity of free prose and turns each criterion into one test case [S1][S2].
3. **Concrete values, not adjectives.** "within 2 s", "at most 50 rows", "`—`" — not "fast",
   "appropriate", "user-friendly". *Why:* a criterion nobody can fail is not a criterion [S4].
4. **What, not how.** No file paths, function, class or component names, libraries, SQL or code.
   Module and package names are fine; so are the contracts that cross a module boundary, in wire
   spelling (`snake_case`). *Why:* the spec must survive a different design; the solution is
   chosen later, by `sdd-engineering:brainstorm` [S3].
5. **Everything traces.** A story has at least one criterion; a criterion names its stories; an
   edge case names the criterion that covers it. Ids never change once the spec is approved.
   *Why:* plans and the verification matrix cite `AC-n` — a renumbered id breaks them [S2].
6. **Every input has exactly one provenance tag; prefer what already exists.** A new model call
   needs a line on why nothing existing can serve. *Why:* where a feature calls a model, its cost is
   mostly those calls, and the spec is the last cheap place to remove one.
7. **Third-party data gets a required handling.** State the requirement ("rendered as text, never
   as HTML"), not the code. The trust boundaries are in the `engineering-paved-path:security` skill.
8. **What is unknown stays visible.** A gap is an open question with a default, never a silent
   guess. *Why:* a marked assumption can be reviewed; a plausible invention cannot [S3].

## Sections

Template: [assets/spec-template.md](assets/spec-template.md). All ten sections, in this order; an
empty one says "None.". Worked example: [references/example-spec.md](references/example-spec.md).

| Section | Item format | Rule |
|---|---|---|
| Problem and user | prose | Who has the problem, what they do today, why it hurts. No solution |
| Goals / Non-goals | bullets | Goals are outcomes one can check. Non-goals carry the reason, declined proposals included |
| User stories | `US-1: As a <role>, I want <capability>, so that <benefit>.` | One role and one capability each; valuable and testable [S4] |
| Workflow and module interactions | Mermaid + field lists | Optional. What crosses between modules and in which order, never how a module works inside. A fenced `mermaid` block; one idea per diagram, labeled edges, about 20 nodes at most |
| Acceptance criteria (EARS) | `AC-1 (US-1): WHEN <trigger>, the <system> shall <response>.` | One of the five patterns below; `the system` or a named module as the subject |
| Edge cases | `EC-1: <situation> → <expected behaviour> (AC-n)` | Only decided behaviour. Nobody decided it yet → no `EC` line: it is an open question (`OQ-n`) until answered |
| Non-functional requirements | `NFR-1: …` | Measurable: performance, cost (model calls and tokens), accessibility, i18n, security, observability. Only the ones this feature has |
| Inputs and provenance | table `Input \| Provenance \| Notes` | One tag per input, see below |
| Untrusted inputs | table `Input \| Who controls it \| Where it goes \| Required handling` | "None." only when the feature truly consumes none |
| Open questions | `OQ-1: <question> — default if unanswered: <assumption>` | A question that blocks a criterion keeps the spec a draft |

### EARS patterns [S1]

| Pattern | Shape | Use it for |
|---|---|---|
| Ubiquitous | `The <system> shall <response>.` | What always holds |
| Event-driven | `WHEN <trigger>, the <system> shall <response>.` | A reaction to one event |
| State-driven | `WHILE <state>, the <system> shall <response>.` | Behaviour that lasts as long as a state does |
| Unwanted behaviour | `IF <condition>, THEN the <system> shall <response>.` | Errors, failures, bad input |
| Optional feature | `WHERE <feature is included>, the <system> shall <response>.` | Behaviour behind a setting or a configuration |

A complex criterion combines them in the same order: `WHILE <state>, WHEN <trigger>, the <system>
shall <response>.` Good and bad pairs, and how to pick a pattern:
[references/ears.md](references/ears.md).

### Provenance tags

| Tag | Meaning | Example |
|---|---|---|
| `[reused: <source>]` | An already produced or stored result is used again | `[reused: stored run statistics]` |
| `[deterministic: <module>]` | Code computes or reads the fact, no model | `[deterministic: billing]` |
| `[new: N LLM call]` | A new model call is needed; Notes say why nothing existing serves | `[new: 1 LLM call]` |

Check the code before you tag: name the stored result in the discovery report with `path:line` as
evidence, then keep the path out of the spec itself. A value that arrives with a request or that the
user types is `[deterministic: <module that reads it>]`.

## Lifecycle

`Status: draft | approved | implemented`. The author writes `draft`; **only the user** sets
`approved`; `sdd-engineering:implementer` sets `implemented` with the plan's last group. Nothing is
planned or built from a `draft`: `sdd-engineering:brainstorm`, `sdd-engineering:implementation-planner`
and the plan check all stop on one. Each criterion has exactly one response because
`sdd-engineering:implementation-verifier` gives one verdict per id.

| To change… | Do this |
|---|---|
| a draft | Edit it in place |
| an approved spec (a gap found while planning or building) | **Amend** it: set it back to `Status: draft`, add an `Amended: <date> — <ids> (<who found it>)` header line, put new requirements under the next free ids, and let the user approve it again. Existing ids are never renumbered, reused or deleted; a wrong criterion is reworded under its id |
| an implemented or legacy spec | Write a new spec with `Supersedes:` and let the user mark the old one |

## Workflow: writing a spec (copy and tick off)

```
- [ ] Sources read; every unreadable one reported, not guessed
- [ ] Design gaps, edge cases, module interactions, inputs worked through (references/design-gaps.md)
- [ ] Unclear → question with numbered options; own idea → proposal; the user answered
- [ ] Location, number and name chosen (Where a spec lives)
- [ ] Template filled; accepted proposals are requirements, declined ones are Non-goals with the reason
- [ ] Each criterion: one EARS pattern, one `shall`, an observable response, a concrete value
- [ ] Each story has a criterion; each edge case names its criterion; undecided cases are open questions, not `EC` lines
- [ ] Each input has one provenance tag; each `new` has its reason
- [ ] Untrusted inputs listed with the required handling
- [ ] No paths, names of functions or components, libraries, SQL or code
- [ ] The folder's README index updated, if it has one; `Status: draft`
- [ ] Check passes
```

## Check

```sh
node "${CLAUDE_SKILL_DIR}/assets/check-spec.mjs"                 # every SPEC-NN spec in <specs_dir>
node "${CLAUDE_SKILL_DIR}/assets/check-spec.mjs" specs/10-x.md   # one spec
node "${CLAUDE_SKILL_DIR}/assets/check-spec.mjs" --specs-dir docs/specs
```

The folder is the `--specs-dir` argument, else the plugin option (`CLAUDE_PLUGIN_OPTION_specs_dir`),
else `specs`. It checks form: header, sections, ids, EARS shape, traceability, provenance tags, code
paths. Errors fail the check; warnings (a vague word, an "and" after `shall`) ask for a second look.
Whether a requirement is the right one is still a human's call. Legacy specs are skipped.
`sdd-engineering:spec-creator` has no shell: a PostToolUse hook runs the check with `--hook` after
each Write or Edit of a spec and hands the errors back.

## Read next

| Question | File |
|---|---|
| Which pattern fits, and what does a bad criterion look like? | [references/ears.md](references/ears.md) |
| What does the design leave out? | [references/design-gaps.md](references/design-gaps.md) |
| What does a finished spec look like? | [references/example-spec.md](references/example-spec.md) |
| The blank template | [assets/spec-template.md](assets/spec-template.md) |

## Out of scope

- Choosing the solution, comparing options - `sdd-engineering:brainstorm`.
- Steps, files, skills to apply - `sdd-engineering:implementation-planner`.
- Trust boundaries and how to handle untrusted data in code - `engineering-paved-path:security`.
- Docs of a feature that exists.
