# spec-authoring

Rules for a feature specification in Spec Driven Development: what a spec contains, how each
requirement is worded (user stories, EARS acceptance criteria, edge cases), the ids that plans and
verification trace to, provenance tags for inputs, required handling for untrusted inputs, and the
`draft -> approved -> implemented` lifecycle. The `spec-creator` agent holds the process (two passes,
reports); this skill holds the rules, so the planner, the verifier and a human reviewer read the same
ones. Choosing a solution and planning the work are out of scope.

The skill is preloaded by the agents `spec-creator`, `implementation-planner` and
`implementation-verifier`, so it has no `disable-model-invocation` flag.

## File map

| File | Answers |
|---|---|
| [SKILL.md](SKILL.md) | Where a spec lives, the one rule, 8 principles, the ten sections and their item formats, EARS patterns, provenance tags, lifecycle, the writing checklist, the check |
| [references/ears.md](references/ears.md) | Which pattern fits; bad -> good criteria; wording rules; from edge case to criterion; user stories |
| [references/design-gaps.md](references/design-gaps.md) | What to look for in a design before writing; what each gap becomes |
| [references/example-spec.md](references/example-spec.md) | A finished invented spec (a link click counter); also the fixture of the check's tests |
| [assets/spec-template.md](assets/spec-template.md) | The one copy of the template |
| [assets/check-spec.mjs](assets/check-spec.mjs) | Runnable form check; `--hook` mode for the PostToolUse hook of the plugin |
| [assets/tests/check-spec.test.mjs](assets/tests/check-spec.test.mjs) | Tests for the check; run with `node assets/tests/check-spec.test.mjs` |

## Sources

`[Sn]` in the skill files refers to the numbers below.

| # | Title | Author | URL | Used for |
|---|---|---|---|---|
| S1 | EARS - Easy Approach to Requirements Syntax | Alistair Mavin | https://alistairmavin.com/ears/ | Five patterns (ubiquitous, state-driven, event-driven, optional feature, unwanted behaviour) plus combinations; clauses always in the same order |
| S2 | Feature specs | Kiro | https://kiro.dev/docs/specs/feature-specs/ | Requirements as user stories with EARS acceptance criteria, each translatable into a test case |
| S3 | spec-template.md | GitHub spec-kit | https://github.com/github/spec-kit/blob/main/templates/spec-template.md | Prioritised stories, an edge cases block, requirement ids, marking what is not specified |
| S4 | INVEST in Good Stories, and SMART Tasks | Bill Wake | https://xp123.com/invest-in-good-stories-and-smart-tasks/ | A story is Independent, Negotiable, Valuable, Estimable, Small, Testable |
| S5 | Specs | Kiro | https://kiro.dev/docs/specs/ | Requirements, design and tasks kept apart |

The skill was extracted from the Spec Driven Development workflow of a private project; the
provenance tags and the design-gap checklist are that workflow's own rules, not taken from an
external source.

## Where the rules differ from the sources

| Topic | Positions | Rule here |
|---|---|---|
| Responses per requirement | EARS allows one or many (S1) | One: a criterion is one test and one verifier verdict |
| Keyword case | EARS writes `While`, `When` (S1); Kiro uses capitals (S2) | Capitals, so the check can tell a keyword from a word |
| Design in the spec | Kiro and spec-kit keep design in a separate file (S5, S3) | Same split across agents: the spec stops at module boundaries; brainstorm and the plan own the design |
| Unknowns | spec-kit marks them inline (S3) | A numbered open question with a default, so an unanswered question still yields a reviewable assumption |
| Acceptance format | spec-kit uses Given/When/Then (S3); Kiro uses EARS (S2) | EARS only: one notation, checkable mechanically |
